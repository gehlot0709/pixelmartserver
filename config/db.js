const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        };

        if (!process.env.MONGO_URI) {
            console.error("CRITICAL ERROR: MONGO_URI is not defined in environment variables!");
            throw new Error("MONGO_URI missing");
        }

        console.log("Connecting to MongoDB...");
        cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
            console.log(`MongoDB Connected: ${mongoose.connection.host}`);
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error(`MongoDB Connection Failed: ${e.message}`);
        throw e;
    }

    return cached.conn;
};

module.exports = connectDB;
