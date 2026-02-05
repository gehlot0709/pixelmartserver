const express = require('express');
const router = express.Router();
const {
    getCategories,
    createCategory,
    deleteCategory,
    migrateCategories
} = require('../controllers/categoryController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(getCategories)
    .post(protect, admin, createCategory);

router.get('/migrate', migrateCategories);

router.route('/:id')
    .delete(protect, admin, deleteCategory);

module.exports = router;
