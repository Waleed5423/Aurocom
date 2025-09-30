const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const paymentService = require('../services/paymentService');
const { sendEmail } = require('../services/emailService');

// Create payment intent
const createPaymentIntent = async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.paymentStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Order already paid'
      });
    }

    let paymentData;

    switch (paymentMethod) {
      case 'stripe':
        paymentData = await paymentService.createStripePaymentIntent(order.total);
        break;
      
      case 'paypal':
        paymentData = await paymentService.createPayPalPayment(order.total);
        break;
      
      case 'jazzcash':
        paymentData = await paymentService.createJazzCashPayment(order.total, order._id);
        break;
      
      case 'easypaisa':
        paymentData = await paymentService.createEasyPaisaPayment(order.total, order._id);
        break;
      
      case 'bank_transfer':
        // For bank transfer, we create a pending transaction
        const transaction = await Transaction.create({
          order: order._id,
          user: req.user._id,
          paymentMethod: 'bank_transfer',
          amount: order.total,
          status: 'pending'
        });
        
        return res.json({
          success: true,
          data: {
            paymentMethod: 'bank_transfer',
            transactionId: transaction._id,
            instructions: 'Please transfer the amount to our bank account and provide the reference number.'
          }
        });
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported payment method'
        });
    }

    // Create transaction record
    const transaction = await Transaction.create({
      order: order._id,
      user: req.user._id,
      paymentMethod,
      amount: order.total,
      gatewayTransactionId: paymentData.paymentIntentId || paymentData.transactionId,
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        ...paymentData,
        transactionId: transaction._id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Confirm payment
const confirmPayment = async (req, res) => {
  try {
    const { transactionId, paymentData } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate('order')
      .populate('user');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status === 'completed') {
      return res.json({
        success: true,
        message: 'Payment already confirmed'
      });
    }

    let paymentConfirmed = false;

    switch (transaction.paymentMethod) {
      case 'stripe':
        if (paymentData.paymentIntentId) {
          paymentConfirmed = await paymentService.confirmStripePayment(paymentData.paymentIntentId);
        }
        break;
      
      case 'paypal':
        // Implement PayPal confirmation
        paymentConfirmed = true; // Placeholder
        break;
      
      case 'jazzcash':
      case 'easypaisa':
        // Implement gateway-specific confirmation
        paymentConfirmed = true; // Placeholder
        break;
    }

    if (paymentConfirmed) {
      // Update transaction status
      transaction.status = 'completed';
      transaction.gatewayResponse = paymentData;
      await transaction.save();

      // Update order status
      const order = transaction.order;
      order.paymentStatus = 'completed';
      order.status = 'confirmed';
      await order.save();

      // Send confirmation email
      try {
        await sendEmail({
          email: transaction.user.email,
          subject: `Payment Confirmed - Order ${order.orderNumber}`,
          html: `
            <h2>Payment Confirmed!</h2>
            <p>Your payment for order ${order.orderNumber} has been confirmed.</p>
            <p><strong>Amount:</strong> $${order.total.toFixed(2)}</p>
            <p><strong>Payment Method:</strong> ${transaction.paymentMethod}</p>
            <p>Thank you for your purchase!</p>
          `
        });
      } catch (emailError) {
        console.log('Payment confirmation email failed:', emailError);
      }

      // Emit real-time notification
      const io = req.app.get('io');
      io.to(transaction.user._id.toString()).emit('paymentConfirmed', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: order.total
      });

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: { transaction, order }
      });
    } else {
      transaction.status = 'failed';
      await transaction.save();

      res.status(400).json({
        success: false,
        message: 'Payment confirmation failed'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Handle bank transfer confirmation (Admin)
const confirmBankTransfer = async (req, res) => {
  try {
    const { transactionId, referenceNumber } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate('order')
      .populate('user');

    if (!transaction || transaction.paymentMethod !== 'bank_transfer') {
      return res.status(404).json({
        success: false,
        message: 'Bank transfer transaction not found'
      });
    }

    // Update transaction
    transaction.status = 'completed';
    transaction.gatewayTransactionId = referenceNumber;
    transaction.gatewayResponse = { referenceNumber, confirmedBy: req.user._id };
    await transaction.save();

    // Update order
    const order = transaction.order;
    order.paymentStatus = 'completed';
    order.status = 'confirmed';
    await order.save();

    // Send notification
    const io = req.app.get('io');
    io.to(transaction.user._id.toString()).emit('paymentConfirmed', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount: order.total
    });

    res.json({
      success: true,
      message: 'Bank transfer confirmed successfully',
      data: { transaction, order }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get payment methods
const getPaymentMethods = async (req, res) => {
  try {
    const methods = [
      {
        id: 'stripe',
        name: 'Credit/Debit Card',
        description: 'Pay securely with your credit or debit card',
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        icon: '💳'
      },
      {
        id: 'paypal',
        name: 'PayPal',
        description: 'Pay with your PayPal account',
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        icon: '🔵'
      },
      {
        id: 'jazzcash',
        name: 'JazzCash',
        description: 'Pay using JazzCash mobile account',
        supportedCurrencies: ['PKR'],
        icon: '📱'
      },
      {
        id: 'easypaisa',
        name: 'EasyPaisa',
        description: 'Pay using EasyPaisa mobile account',
        supportedCurrencies: ['PKR'],
        icon: '📲'
      },
      {
        id: 'bank_transfer',
        name: 'Bank Transfer',
        description: 'Transfer amount directly to our bank account',
        supportedCurrencies: ['USD', 'PKR', 'EUR'],
        icon: '🏦'
      }
    ];

    res.json({
      success: true,
      data: { methods }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Stripe webhook handler
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      // Find transaction and update status
      const transaction = await Transaction.findOne({
        gatewayTransactionId: paymentIntent.id
      }).populate('order').populate('user');

      if (transaction) {
        transaction.status = 'completed';
        transaction.gatewayResponse = paymentIntent;
        await transaction.save();

        // Update order
        const order = transaction.order;
        order.paymentStatus = 'completed';
        order.status = 'confirmed';
        await order.save();

        // Send notifications
        const io = req.app.get('io');
        io.to(transaction.user._id.toString()).emit('paymentConfirmed', {
          orderId: order._id,
          orderNumber: order.orderNumber
        });
      }
      break;
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      
      await Transaction.findOneAndUpdate(
        { gatewayTransactionId: failedPayment.id },
        { status: 'failed', gatewayResponse: failedPayment }
      );
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  confirmBankTransfer,
  getPaymentMethods,
  handleStripeWebhook
};