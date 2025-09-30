const express = require('express');
const {
  createOrder,
  getUserOrders,
  getOrder,
  cancelOrder
} = require('../controllers/orderController');
const { auth } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// User routes
router.use(auth);

router.post('/', createOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrder);
router.patch('/:id/cancel', cancelOrder);

// Admin routes would be added here for order management
// These would typically include:
// - Get all orders
// - Update order status
// - Process refunds
// - etc.

module.exports = router;