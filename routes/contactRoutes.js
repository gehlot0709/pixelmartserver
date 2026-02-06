const express = require('express');
const router = express.Router();
const { submitContact } = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, submitContact);

module.exports = router;
