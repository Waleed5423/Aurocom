const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Comment is required'],
    trim: true,
    maxlength: [1000, 'Comment cannot be more than 1000 characters']
  },
  images: [{
    public_id: String,
    url: String
  }],
  verifiedPurchase: {
    type: Boolean,
    default: false
  },
  helpful: {
    count: {
      type: Number,
      default: 0
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  reported: {
    count: {
      type: Number,
      default: 0
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    reasons: [String]
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  adminResponse: {
    comment: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  }
}, {
  timestamps: true
});

// Compound index to ensure one review per product per user
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Index for better performance
reviewSchema.index({ product: 1, rating: -1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ isApproved: 1, isActive: 1 });
reviewSchema.index({ createdAt: -1 });

// Static method to update product ratings
reviewSchema.statics.updateProductRatings = async function(productId) {
  const stats = await this.aggregate([
    {
      $match: { 
        product: productId,
        isApproved: true,
        isActive: true 
      }
    },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        ratingCount: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (stats.length > 0) {
    const { averageRating, ratingCount, ratingDistribution } = stats[0];
    
    // Calculate rating distribution
    const distribution = {
      1: ratingDistribution.filter(r => r === 1).length,
      2: ratingDistribution.filter(r => r === 2).length,
      3: ratingDistribution.filter(r => r === 3).length,
      4: ratingDistribution.filter(r => r === 4).length,
      5: ratingDistribution.filter(r => r === 5).length
    };

    await mongoose.model('Product').findByIdAndUpdate(productId, {
      'ratings.average': Math.round(averageRating * 10) / 10,
      'ratings.count': ratingCount,
      'ratings.distribution': distribution
    });
  }
};

// Call updateProductRatings after saving a review
reviewSchema.post('save', function() {
  this.constructor.updateProductRatings(this.product);
});

// Call updateProductRatings after removing a review
reviewSchema.post('remove', function() {
  this.constructor.updateProductRatings(this.product);
});

module.exports = mongoose.model('Review', reviewSchema);