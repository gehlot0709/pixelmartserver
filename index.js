require('dotenv').config();
const express = require('express');

// process.on('uncaughtException', (err) => {
//     console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
//     console.error(err.name, err.message);
//     console.error(err.stack);
//     process.exit(1);
// });

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥');
    console.error(err.name, err.message);
    // process.exit(1); // Don't exit immediately during debug
});
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');

// Initialize App
const app = express();

// Connect to Database
connectDB();

// Keep process alive for debugging
// setInterval(() => {
//     // console.log('Heartbeat...'); 
// }, 10000);

// DB Connection Middleware moved after CORS

// Middleware
app.use(express.json());

// Enable Private Network Access (CORS Loopback)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Control-Allow-Private-Network');
    }
    next();
});

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            "http://localhost:5173",
            "http://localhost:5000",
            "https://pixelmart-eta.vercel.app",
        ];

        // Check if origin is in allowedOrigins or matches dynamic regex for Vercel previews
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.log("Blocked by CORS:", origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// DB Connection Middleware (Executed after CORS to ensure headers are present on error)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("Database Connection Error:", error);
        res.status(500).json({ message: "Database Connection Failed", error: error.message });
    }
});

// Static folder for uploads (if needed later)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic Route
app.get('/', (req, res) => {
    res.send('PixelMart API is running...');
});

// Define Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// Make uploads public
app.use('/server/uploads', express.static(path.join(__dirname, '/server/uploads')));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
