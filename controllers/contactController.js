const sendEmail = require('../utils/sendEmail');

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Private
const submitContact = async (req, res) => {
    const { email, message } = req.body;

    if (!message) {
        return res.status(400).json({ message: 'Please provide a message' });
    }

    try {
        // Send email to store owner
        await sendEmail({
            email: process.env.EMAIL_USER,
            subject: `New Contact Form Submission from ${req.user.name}`,
            message: `You have a new message from your store contact form.\n\nSender Email: ${email || req.user.email}\nSender Name: ${req.user.name}\n\nMessage:\n${message}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #6366f1;">New Contact Message</h2>
                    <p><strong>From:</strong> ${req.user.name} (${email || req.user.email})</p>
                    <p><strong>Message:</strong></p>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 5px; margin-top: 10px;">
                        ${message.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `
        });

        res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Contact Form Error:', error);
        res.status(500).json({ message: 'Failed to send message. Please try again later.' });
    }
};

module.exports = { submitContact };
