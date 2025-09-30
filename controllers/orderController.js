const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { sendEmail } = require('../services/emailService');

// Create new order
const createOrder = async (req, res) => {
  try {
    const {
      shippingAddress,
      billingAddress,
      paymentMethod,
      couponCode,
      notes
    } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product')
      .populate('coupon');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Validate stock and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;
      
      // Check stock
      if (product.trackQuantity && product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`
        });
      }

      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images.find(img => img.isDefault)?.url || product.images[0]?.url,
        price: item.price,
        quantity: item.quantity,
        variant: item.variant,
        total: itemTotal
      });
    }

    // Calculate totals
    const shipping = cart.shipping || 0;
    const tax = cart.tax || 0;
    const discount = cart.discount || 0;
    const total = subtotal + shipping + tax - discount;

    // Create order
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod,
      subtotal,
      shipping,
      tax,
      discount,
      total,
      coupon: cart.coupon?._id,
      notes
    });

    // Update product quantities
    for (const item of cart.items) {
      if (item.product.trackQuantity) {
        await Product.findByIdAndUpdate(
          item.product._id,
          { 
            $inc: { 
              quantity: -item.quantity,
              salesCount: item.quantity
            } 
          }
        );
      }
    }

    // Clear cart
    await Cart.findOneAndDelete({ user: req.user._id });

    // Send order confirmation email
    try {
      await sendEmail({
        email: req.user.email,
        subject: `Order Confirmation - ${order.orderNumber}`,
        html: `
          <h2>Order Confirmed!</h2>
          <p>Thank you for your order. Here are your order details:</p>
          <p><strong>Order Number:</strong> ${order.orderNumber}</p>
          <p><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
          <p><strong>Shipping Address:</strong></p>
          <p>${shippingAddress.name}<br>
          ${shippingAddress.street}<br>
          ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}<br>
          ${shippingAddress.country}</p>
          <p>We'll notify you when your order ships.</p>
        `
      });
    } catch (emailError) {
      console.log('Order confirmation email failed:', emailError);
    }

    // Emit real-time notification
    const io = req.app.get('io');
    io.to(req.user._id.toString()).emit('orderCreated', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get user orders
const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single order
const getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('items.product', 'name images');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Only allow cancellation for pending or confirmed orders
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();

    // Restore product quantities
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: item.quantity } }
      );
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrder,
  cancelOrder
};