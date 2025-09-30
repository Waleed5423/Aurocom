const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative']
  },
  maxDiscount: {
    type: Number,
    min: 0
  },
  minOrderValue: {
    type: Number,
    min: 0
  },
  usageLimit: {
    type: Number,
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  userLimit: {
    type: Number,
    min: 1
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  excludedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better performance
couponSchema.index({ code: 1 });
couponSchema.index({ expiresAt: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ validFrom: 1, expiresAt: 1 });

// Virtual for isValid
couponSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.expiresAt > now &&
         (!this.usageLimit || this.usedCount < this.usageLimit);
});

// Pre-save to uppercase code
couponSchema.pre('save', function(next) {
  this.code = this.code.toUpperCase();
  next();
});

module.exports = mongoose.model('Coupon', couponSchema);