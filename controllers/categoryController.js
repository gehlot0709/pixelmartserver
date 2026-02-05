const Category = require('../models/Category');
const Product = require('../models/Product');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.json(categories);
    } catch (error) {
        console.error("Error in getCategories:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = async (req, res) => {
    try {
        const { name, image } = req.body;
        const categoryExists = await Category.findOne({ name });

        if (categoryExists) {
            return res.status(400).json({ message: 'Category already exists' });
        }

        const category = await Category.create({
            name,
            image // Assumes image URL is sent or handled separately
        });

        res.status(201).json(category);
    } catch (error) {
        console.error("Error in createCategory:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (category) {
            await category.remove();
            res.json({ message: 'Category removed' });
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        console.error("Error in deleteCategory:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
// @desc    Migrate category and product images from localhost to relative paths
// @route   GET /api/categories/migrate
// @access  Public
exports.migrateCategories = async (req, res) => {
    try {
        const categories = await Category.find({});
        let catCount = 0;
        for (let cat of categories) {
            if (cat.image && (cat.image.includes('localhost:5000/uploads/') || cat.image.includes('localhost:5000/server/uploads/'))) {
                const parts = cat.image.split('/');
                const filename = parts[parts.length - 1];
                const subfolder = parts[parts.length - 2];

                // If it was in categories subfolder
                if (subfolder === 'categories') {
                    cat.image = `/assets/categories/${filename}`;
                } else {
                    cat.image = `/assets/${filename}`;
                }

                await cat.save();
                catCount++;
            }
        }

        const products = await Product.find({});
        let prodCount = 0;
        for (let prod of products) {
            let changed = false;
            const updatedImages = prod.images.map(img => {
                if (img && (img.includes('localhost:5000/uploads/') || img.includes('localhost:5000/server/uploads/'))) {
                    changed = true;
                    const filename = img.split('/').pop();
                    return `/assets/${filename}`; // Moved to public assets
                }
                return img;
            });

            if (changed) {
                prod.images = updatedImages;
                await prod.save();
                prodCount++;
            }
        }

        res.json({
            message: "Migration completed successfully",
            updatedCategories: catCount,
            updatedProducts: prodCount
        });
    } catch (error) {
        console.error("Error in migrateCategories:", error);
        res.status(500).json({ message: 'Migration Failed', error: error.message });
    }
};
