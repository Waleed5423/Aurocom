const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  variant: {
    name: String,
    value: String,
    price: Number
  },
  price: {
    type: Number,
    required: true
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  guestId: String, // For guest users
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  discount: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Calculate subtotal
cartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
});

// Calculate total
cartSchema.virtual('total').get(function() {
  return this.subtotal + this.shipping + this.tax - this.discount;
});

// Update cart timestamps on save
cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Cart', cartSchema);