const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail', // You can use other services or host/port
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: `PixelMart Support <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to: ${options.email}`);
    } catch (error) {
        console.error("Nodemailer Send Error:", error);
        throw error;
    }
};

module.exports = sendEmail;
