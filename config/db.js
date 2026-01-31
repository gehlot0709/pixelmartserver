const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        console.error(error); // Log full error object
        // process.exit(1); // Do not exit in serverless environment, let the request fail cleanly
    }
};

module.exports = connectDB;
