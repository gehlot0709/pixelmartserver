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
            const tokens = keyword.toLowerCase().trim().split(/\s+/);
            const synonymMap = {
                'mans': 'men', 'man': 'men', 'mens': 'men', 'male': 'men',
                'womans': 'women', 'woman': 'women', 'womens': 'women', 'female': 'women',
                'kids': 'kid', 'child': 'kid', 'children': 'kid'
            };

            // We want products that match ALL tokens (AND across tokens)
            const tokenFilters = await Promise.all(tokens.map(async (token) => {
                const searchTerms = [token];
                if (synonymMap[token]) {
                    searchTerms.push(synonymMap[token]);
                }

                // Find categories matching this specific token exactly
                const matchingCategories = await Category.find({
                    $or: searchTerms.map(term => ({
                        name: { $regex: `^${term}$`, $options: 'i' }
                    }))
                });
                const matchingCategoryIds = matchingCategories.map(c => c._id);

                // Find subcategories
                const subCategoriesOfMatches = await Category.find({ parent: { $in: matchingCategoryIds } });
                const allRelatedCatIds = [...matchingCategoryIds, ...subCategoriesOfMatches.map(c => c._id)];

                // Return a filter for THIS token
                return {
                    $or: [
                        { title: { $regex: token, $options: 'i' } },
                        { description: { $regex: token, $options: 'i' } },
                        { category: { $in: allRelatedCatIds } }
                    ]
                };
            }));

            if (tokenFilters.length > 0) {
                query.$and = tokenFilters;
            }
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
        const { limit: queryLimit } = req.query;
        const pageSize = Number(queryLimit) || 12;
        const page = Number(pageNumber) || 1;

        const count = await Product.countDocuments(query);
        const products = await Product.find(query)
            .sort(sortOption)
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .populate('category', 'name');

        res.json({ products, page, pages: Math.ceil(count / pageSize), total: count });
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
        let mainImage = '';

        if (req.files) {
            if (req.files.mainImage && req.files.mainImage[0]) {
                mainImage = req.files.mainImage[0].path;
            }
            if (req.files.images) {
                images = req.files.images.map(file => file.path);
            }
        }

        const product = new Product({
            title,
            description,
            price: Number(price),
            category,
            stock: Number(stock),
            images,
            mainImage,
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

            if (req.files) {
                if (req.files.mainImage && req.files.mainImage[0]) {
                    product.mainImage = req.files.mainImage[0].path;
                }
                if (req.files.images && req.files.images.length > 0) {
                    product.images = req.files.images.map(file => file.path); // Cloudinary returns the full URL in file.path
                }
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
// @desc    Get recommended products (Same category, similar price +/- 20%)
// @route   GET /api/products/recommend/:productId
// @access  Public
exports.getRecommendedProducts = async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        let recommended = [];
        const mongoose = require('mongoose');

        // Check if category is a valid ObjectId before querying
        if (mongoose.Types.ObjectId.isValid(product.category)) {
            const minPrice = product.price * 0.8;
            const maxPrice = product.price * 1.2;

            recommended = await Product.find({
                _id: { $ne: product._id },
                category: product.category,
                price: { $gte: minPrice, $lte: maxPrice }
            }).limit(4);

            // If not enough products, find other products in same category
            if (recommended.length < 4) {
                const extra = await Product.find({
                    _id: { $ne: product._id, $nin: recommended.map(p => p._id) },
                    category: product.category
                }).limit(4 - recommended.length);
                recommended.push(...extra);
            }
        } else {
            console.warn(`Product ${product._id} has invalid category ID: ${product.category}. Skipping category-specific recommendations.`);
        }

        // Final fallback: if still not enough products, find ANY other products from other categories
        if (recommended.length < 4) {
            const finalExtra = await Product.find({
                _id: { $ne: product._id, $nin: recommended.map(p => p._id) }
            }).limit(4 - recommended.length);
            recommended.push(...finalExtra);
        }

        res.json(recommended);
    } catch (error) {
        console.error("Error in getRecommendedProducts:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get delivery estimate based on pincode
// @route   POST /api/products/estimate-delivery
// @access  Public
exports.getDeliveryEstimate = async (req, res) => {
    try {
        const { pincode } = req.body;
        if (!pincode || pincode.length !== 6) {
            return res.status(400).json({ message: 'Invalid Pincode' });
        }

        // Metro cities (Delhi, Mumbai, Bengaluru, Chennai, Hyderabad, Kolkata)
        const metroPrefixes = ['11', '40', '56', '60', '50', '70'];
        const prefix = pincode.substring(0, 2);

        let estimate = "";
        if (metroPrefixes.includes(prefix)) {
            estimate = "2–3 days (Metro Delivery)";
        } else if (pincode.startsWith('1')) { // assuming some logic for remote
            estimate = "5–7 days (Remote Area)";
        } else {
            estimate = "3–5 days (Standard Delivery)";
        }

        res.json({ estimate });
    } catch (error) {
        console.error("Error in getDeliveryEstimate:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};
