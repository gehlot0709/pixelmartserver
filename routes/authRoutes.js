const express = require('express');
const router = express.Router();
const { registerUser, loginUser, verifyOTP, resendOTP, getMe, forgotPassword, resetPassword, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/change-password', protect, changePassword);
router.get('/me', protect, getMe);

// Admin Routes
const { admin } = require('../middleware/authMiddleware');
const { getUsers, updateUserStatus } = require('../controllers/authController');
router.get('/users', protect, admin, getUsers);
router.put('/users/:id/status', protect, admin, updateUserStatus);

module.exports = router;
