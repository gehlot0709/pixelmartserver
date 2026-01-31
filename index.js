require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');

// Initialize App
const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://pixelmart-eta.vercel.app"
    ],
    credentials: true
}));

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
