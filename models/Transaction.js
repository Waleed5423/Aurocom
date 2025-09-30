const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'jazzcash', 'easypaisa', 'bank_transfer'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  gatewayTransactionId: String,
  gatewayResponse: mongoose.Schema.Types.Mixed,
  refundAmount: {
    type: Number,
    default: 0
  },
  refundReason: String,
  refundedAt: Date,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Index for better performance
transactionSchema.index({ order: 1 });
transactionSchema.index({ user: 1 });
transactionSchema.index({ gatewayTransactionId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);