const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    createProductReview,
    deleteProduct,
    getRecommendedProducts,
    getDeliveryEstimate
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/')
    .get(getProducts)
    .post(protect, admin, upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'images', maxCount: 5 }]), createProduct);

router.route('/recommend/:productId')
    .get(getRecommendedProducts);

router.route('/estimate-delivery')
    .post(getDeliveryEstimate);

router.route('/:id')
    .get(getProductById)
    .put(protect, admin, upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'images', maxCount: 5 }]), updateProduct)
    .delete(protect, admin, deleteProduct);

router.route('/:id/reviews')
    .post(protect, createProductReview);

module.exports = router;
