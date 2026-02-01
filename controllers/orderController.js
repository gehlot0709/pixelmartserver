const Order = require('../models/Order');
const Product = require('../models/Product');
const sendEmail = require('../utils/sendEmail');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.addOrderItems = async (req, res) => {
    try {
        const {
            orderItems,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            totalPrice,
            paymentProof // URL from upload
        } = req.body;

        if (orderItems && orderItems.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        }

        // Check stock and prices
        for (const item of orderItems) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(404).json({ message: `Product not found: ${item.name}` });
            }
            if (product.stock < item.qty) {
                return res.status(400).json({ message: `Out of stock: ${item.name}` });
            }
            // Decrement Stock
            product.stock -= item.qty;
            product.soldCount += item.qty;
            await product.save();
        }

        const order = new Order({
            orderItems,
            user: req.user._id,
            shippingAddress,
            paymentMethod,
            paymentResult: {
                status: 'Pending Verification',
                email_address: req.user.email,
                screenshot: paymentProof
            },
            totalPrice
        });

        const createdOrder = await order.save();

        // Send Email (fail silently if email service is down)
        // Send Email (fail silently if email service is down)
        try {
            const tableRows = orderItems.map(item => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                        <img src="${process.env.CLIENT_URL || 'http://localhost:5173'}${item.image}" alt="${item.name}" width="50" style="border-radius: 5px;">
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.qty}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.size || '-'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.color || '-'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">₹${item.price}</td>
                </tr>
            `).join('');

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #4F46E5; text-align: center;">Thank You for Your Order!</h2>
                    <p>Hi ${shippingAddress.name},</p>
                    <p>We have received your order <strong>#${createdOrder._id}</strong>.</p>
                    
                    <h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">Order Summary</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="padding: 10px; text-align: left;">Image</th>
                                <th style="padding: 10px; text-align: left;">Product</th>
                                <th style="padding: 10px; text-align: left;">Qty</th>
                                <th style="padding: 10px; text-align: left;">Size</th>
                                <th style="padding: 10px; text-align: left;">Color</th>
                                <th style="padding: 10px; text-align: left;">Price</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>

                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p><strong>Total Price:</strong> ₹${totalPrice}</p>
                        <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                    </div>

                    <h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">Shipping Details</h3>
                    <p><strong>Name:</strong> ${shippingAddress.name}</p>
                    <p><strong>Email:</strong> ${shippingAddress.email}</p>
                    <p><strong>Phone:</strong> ${shippingAddress.phone}</p>
                    <p><strong>Address:</strong><br>
                    ${shippingAddress.houseNumber}, ${shippingAddress.flatSociety}<br>
                    ${shippingAddress.address}, ${shippingAddress.city}<br>
                    ${shippingAddress.state}, ${shippingAddress.country} - ${shippingAddress.postalCode}</p>

                    <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #888;">
                        Need help? Reply to this email.<br>
                        &copy; ${new Date().getFullYear()} PixelMart
                    </p>
                </div>
            `;

            await sendEmail({
                email: shippingAddress.email, // Send to the email provided in shipping address
                subject: `Order Confirmation - #${createdOrder._id}`,
                message: `Thank you for your order! Order ID: ${createdOrder._id}. Total: ${totalPrice}`, // Fallback text
                html: emailHtml
            });
        } catch (emailError) {
            console.error("Email sending failed:", emailError.message);
        }

        res.status(201).json(createdOrder);
    } catch (error) {
        console.error("Order Creation Error:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name email');

        if (order) {
            // User can only see their own order, Admin can see all
            if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }
            res.json(order);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update order to paid (Admin verifies QR proof)
// @route   PUT /api/orders/:id/pay
// @access  Private/Admin
exports.updateOrderToPaid = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (order) {
            order.isPaid = true;
            order.paidAt = Date.now();
            order.status = 'Processing';

            const updatedOrder = await order.save();
            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
exports.updateOrderToDelivered = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (order) {
            order.isDelivered = true;
            order.deliveredAt = Date.now();
            order.status = 'Delivered';

            const updatedOrder = await order.save();
            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).populate('user', 'id name').sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get Sales Statistics
// @route   GET /api/orders/stats/sales
// @access  Private/Admin
exports.getSalesStats = async (req, res) => {
    try {
        const date = new Date();
        const lastMonth = new Date(date.setMonth(date.getMonth() - 1));
        const previousMonth = new Date(new Date().setMonth(lastMonth.getMonth() - 1));

        // Monthly Sales (Simple aggregation)
        // This is a simplified example. Real aggregation might need $group by month/year.

        // Total Sales & Count
        const totalOrders = await Order.countDocuments();
        const totalSales = await Order.aggregate([
            { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]);

        // Highest selling product
        const topProducts = await Product.find({}).sort({ soldCount: -1 }).limit(5);

        res.json({
            totalOrders,
            totalSales: totalSales[0] ? totalSales[0].total : 0,
            topProducts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
