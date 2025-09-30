const express = require('express');
const {
  createPaymentIntent,
  confirmPayment,
  confirmBankTransfer,
  getPaymentMethods,
  handleStripeWebhook
} = require('../controllers/paymentController');
const { auth } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// Webhook route (no auth required)
router.post('/stripe-webhook', express.raw({type: 'application/json'}), handleStripeWebhook);

// Protected routes
router.use(auth);

router.get('/methods', getPaymentMethods);
router.post('/create-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);

// Admin routes
router.post('/bank-transfer/confirm', adminAuth, confirmBankTransfer);

module.exports = router;