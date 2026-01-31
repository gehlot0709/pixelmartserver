const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        console.log("Using cached MongoDB connection");
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: true, // Re-enable buffering to avoid race conditions
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
            console.log(`MongoDB Connected: ${mongoose.connection.host}`);
            return mongoose;
        }).catch(err => {
            console.error(`MongoDB Initial Connection Error: ${err.message}`);
            throw err;
        });
    }

    try {
        cached.conn = await cached.promise;
        return cached.conn;
    } catch (e) {
        cached.promise = null;
        console.error(`MongoDB Connection Failed: ${e.message}`);
        // Let the error bubble up so the request fails 
    }
};

module.exports = connectDB;
