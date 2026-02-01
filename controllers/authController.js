const User = require('../models/User');
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please add all fields' });
        }

        // Check if user exists
        let user = await User.findOne({ email });

        if (user) {
            if (user.verified) {
                return res.status(400).json({ message: 'User already exists' });
            }
            // User exists but not verified -> Update logic (Resend Flow)
            // We'll update the password/name if changed, and new OTP
            const otp = otpGenerator.generate(6, {
                upperCaseAlphabets: false,
                specialChars: false,
                lowerCaseAlphabets: false
            });

            user.name = name;
            user.password = password; // Will be hashed by pre-save hook
            user.otp = otp;
            user.otpExpires = Date.now() + 10 * 60 * 1000;
            await user.save();

            const message = `Your OTP for PixelMart registration is ${otp}. It is valid for 10 minutes.`;
            try {
                await sendEmail({
                    email: user.email,
                    subject: 'PixelMart Email Verification',
                    message
                });
                return res.status(200).json({
                    message: 'Verification email sent. Please check your inbox.',
                    email: user.email
                });
            } catch (error) {
                console.error("Email send failed for existing unverified user:", error);
                // Log full error for debugging
                console.error(JSON.stringify(error, null, 2));
                return res.status(500).json({ message: 'Email could not be sent. Please check credentials.' });
            }
        }

        // --- New User Logic ---

        // Generate OTP
        const otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false
        });

        // Create user (verified: false initially)
        user = await User.create({
            name,
            email,
            password,
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000 // 10 mins
        });

        // Send OTP via Email
        const message = `Your OTP for PixelMart registration is ${otp}. It is valid for 10 minutes.`;
        try {
            await sendEmail({
                email: user.email,
                subject: 'PixelMart Email Verification',
                message
            });
            res.status(201).json({
                message: 'Registered successfully. Please check your email for OTP.',
                email: user.email
            });
        } catch (error) {
            console.error("Email send failed for new user, rolling back:", error);
            // Critical: Delete the user if email fails so they can try again or fix email
            await User.deleteOne({ _id: user._id });
            res.status(500).json({ message: 'Email could not be sent. User not created.' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (user.verified) {
            return res.status(200).json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user.id),
                message: 'User already verified'
            });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
        }

        // OTP Valid
        user.verified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user email
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            if (!user.verified) {
                return res.status(401).json({ message: 'Please verify your email first' });
            }

            res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user.id)
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Me
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.verified) {
            return res.status(400).json({ message: 'User already verified' });
        }

        // Generate new OTP
        const otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false
        });

        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
        await user.save();

        // Send Email
        const message = `Your new OTP for PixelMart registration is ${otp}. It is valid for 10 minutes.`;
        try {
            await sendEmail({
                email: user.email,
                subject: 'PixelMart Email Verification (Resent)',
                message
            });
            res.status(200).json({ message: 'OTP resent successfully' });
        } catch (error) {
            console.error(error);
            // If email fails, we still want to save the OTP ideally, but user can't get it.
            // For now, return error.
            console.error("Resend OTP Email failed:", error);
            res.status(500).json({ message: 'Email could not be sent' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
// @desc    Forgot Password (Send OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate OTP
        const otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false
        });

        // Save OTP to user (hashed or plain - for simplicity we save plain here but expiring)
        user.resetPasswordOtp = otp;
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 Minutes
        await user.save();

        const message = `You requested a password reset. Your OTP is ${otp}. It is valid for 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'PixelMart Password Reset OTP',
                message
            });
            res.status(200).json({ message: 'OTP sent to email' });
        } catch (error) {
            console.error("Forgot Password Email failed:", error);
            user.resetPasswordOtp = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();
            return res.status(500).json({ message: 'Email could not be sent. Please check server logs.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reset Password (Verify OTP & New Pass)
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, password } = req.body;
        const user = await User.findOne({
            email,
            resetPasswordOtp: otp,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid OTP or expired' });
        }

        user.password = password; // Will be hashed via pre-save hook
        user.resetPasswordOtp = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Change Password (Authenticated)
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        if (user && (await user.matchPassword(currentPassword))) {
            user.password = newPassword;
            await user.save();
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(401).json({ message: 'Invalid current password' });
        }
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ message: 'Server error' });
    }
};
