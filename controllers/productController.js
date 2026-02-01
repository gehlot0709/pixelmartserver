const Category = require('../models/Category');
const Product = require('../models/Product');
const Review = require('../models/Review');

// @desc    Fetch all products with filtering, sorting, pagination
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
    try {
        const { keyword, category, priceMin, priceMax, sort, pageNumber, isOffer } = req.query;

        // Build query
        let query = {};

        if (keyword) {
            query.title = { $regex: keyword, $options: 'i' };
        }

        if (category) {
            if (category.match(/^[0-9a-fA-F]{24}$/)) {
                // Find all subcategories for this category
                const subCategories = await Category.find({ parent: category });
                const subCategoryIds = subCategories.map(c => c._id);

                // Include the category itself and all its subcategories
                query.category = { $in: [category, ...subCategoryIds] };
            } else {
                console.log('Invalid Category ID ignored:', category);
            }
        }

        if (isOffer) {
            query.isOffer = isOffer === 'true';
        }

        if (priceMin || priceMax) {
            query.price = {};
            if (priceMin) query.price.$gte = Number(priceMin);
            if (priceMax) query.price.$lte = Number(priceMax);
        }

        // Sorting
        let sortOption = {}; // default
        if (sort === 'price_asc') sortOption.price = 1;
        if (sort === 'price_desc') sortOption.price = -1;
        if (sort === 'newest') sortOption.createdAt = -1;
        if (sort === 'rating') sortOption.averageRating = -1;

        // Pagination
        const pageSize = 12;
        const page = Number(pageNumber) || 1;

        const count = await Product.countDocuments(query);
        const products = await Product.find(query)
            .sort(sortOption)
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .populate('category', 'name');

        res.json({ products, page, pages: Math.ceil(count / pageSize) });
    } catch (error) {
        console.error("Error in getProducts:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category', 'name');
        // Reviews are separate, but we can fetch them here or separate API

        if (product) {
            // Fetch reviews
            const reviews = await Review.find({ product: req.params.id }).populate('user', 'name');
            res.json({ ...product.toObject(), reviews });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error("Error in getProductById:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res) => {
    try {
        const { title, description, price, category, stock, sizes, colors, deliveryTime, isOffer } = req.body;

        console.log("Creating Product with body:", { title, price, category, stock, sizes, colors, isOffer });
        console.log("Images received:", req.files ? req.files.length : 0);

        if (!req.user) {
            console.error("No user found in req.user - product creator missing");
            return res.status(401).json({ message: 'User context missing' });
        }

        let images = [];
        if (req.files) {
            images = req.files.map(file => `/uploads/${file.filename}`);
        }

        const product = new Product({
            title,
            description,
            price: Number(price),
            category,
            stock: Number(stock),
            images,
            sizes: sizes ? (typeof sizes === 'string' ? sizes.split(',') : sizes) : [],
            colors: colors ? (typeof colors === 'string' ? colors.split(',') : colors) : [],
            deliveryTime,
            isOffer: isOffer === 'true' || isOffer === true,
            user: req.user._id
        });

        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        console.error("Error in createProduct:", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Validation Error', errors: messages });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
exports.createProductReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const product = await Product.findById(req.params.id);

        if (product) {
            const alreadyReviewed = await Review.findOne({
                product: req.params.id,
                user: req.user._id
            });

            if (alreadyReviewed) {
                return res.status(400).json({ message: 'Product already reviewed' });
            }

            const review = new Review({
                user: req.user._id,
                product: req.params.id,
                rating: Number(rating),
                comment
            });

            await review.save();

            // Recalculate average rating
            const reviews = await Review.find({ product: req.params.id });
            product.numOfReviews = reviews.length;
            product.averageRating =
                reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;

            await product.save();
            res.status(201).json({ message: 'Review added' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
    try {
        const { title, description, price, category, stock, sizes, colors, deliveryTime, isOffer } = req.body;

        console.log("Updating Product ID:", req.params.id);
        console.log("Update body:", { title, price, category, stock, sizes, colors, isOffer });

        const product = await Product.findById(req.params.id);

        if (product) {
            product.title = title || product.title;
            product.description = description || product.description;
            product.price = price ? Number(price) : product.price;
            product.category = category || product.category;
            product.stock = stock ? Number(stock) : product.stock;
            product.deliveryTime = deliveryTime || product.deliveryTime;
            product.isOffer = isOffer === 'true' || isOffer === true;

            if (req.files && req.files.length > 0) {
                product.images = req.files.map(file => `/uploads/${file.filename}`);
            }

            if (sizes !== undefined) {
                product.sizes = sizes ? (typeof sizes === 'string' ? sizes.split(',') : sizes) : [];
            }
            if (colors !== undefined) {
                product.colors = colors ? (typeof colors === 'string' ? colors.split(',') : colors) : [];
            }

            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error("Error in updateProduct:", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Validation Error', errors: messages });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (product) {
            await Product.deleteOne({ _id: req.params.id });
            res.json({ message: 'Product removed' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
