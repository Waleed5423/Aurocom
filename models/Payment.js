const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ gatewayTransactionId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

// Virtual for isRefundable
paymentSchema.virtual('isRefundable').get(function() {
  return this.status === 'completed' && 
         this.refundAmount < this.amount &&
         new Date(this.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
});

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  return stats;
};

module.exports = mongoose.model('Payment', paymentSchema);