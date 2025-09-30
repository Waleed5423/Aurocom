const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Get reviews for a product
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, rating, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const filter = { 
      product: productId,
      isApproved: true,
      isActive: true
    };

    if (rating) {
      filter.rating = Number(rating);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const reviews = await Review.find(filter)
      .populate('user', 'name avatar')
      .populate('adminResponse.respondedBy', 'name')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get review statistics
    const stats = await Review.aggregate([
      {
        $match: { 
          product: mongoose.Types.ObjectId(productId),
          isApproved: true,
          isActive: true 
        }
      },
      {
        $group: {
          _id: '$product',
          average: { $avg: '$rating' },
          count: { $sum: 1 },
          distribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    const total = await Review.countDocuments(filter);

    const reviewStats = stats[0] ? {
      average: Math.round(stats[0].average * 10) / 10,
      count: stats[0].count,
      distribution: {
        1: stats[0].distribution.filter(r => r === 1).length,
        2: stats[0].distribution.filter(r => r === 2).length,
        3: stats[0].distribution.filter(r => r === 3).length,
        4: stats[0].distribution.filter(r => r === 4).length,
        5: stats[0].distribution.filter(r => r === 5).length
      }
    } : {
      average: 0,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    res.json({
      success: true,
      data: {
        reviews,
        stats: reviewStats,
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

// Create review
const createReview = async (req, res) => {
  try {
    const { productId, orderId, rating, title, comment, images } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Verify that user purchased the product
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
      status: 'delivered',
      'items.product': productId
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'You can only review products you have purchased and received'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      product: productId,
      user: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    const review = await Review.create({
      product: productId,
      user: req.user._id,
      order: orderId,
      rating,
      title,
      comment,
      images,
      verifiedPurchase: true
    });

    const populatedReview = await Review.findById(review._id)
      .populate('user', 'name avatar')
      .populate('adminResponse.respondedBy', 'name');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: { review: populatedReview }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update review
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;

    const review = await Review.findOne({
      _id: id,
      user: req.user._id
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Only allow updating within 30 days of creation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (review.createdAt < thirtyDaysAgo) {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be updated within 30 days of submission'
      });
    }

    if (rating) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (images !== undefined) review.images = images;

    await review.save();

    const updatedReview = await Review.findById(review._id)
      .populate('user', 'name avatar')
      .populate('adminResponse.respondedBy', 'name');

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: { review: updatedReview }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete review
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findOne({
      _id: id,
      user: req.user._id
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Soft delete
    review.isActive = false;
    await review.save();

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mark review as helpful
const markHelpful = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user already marked as helpful
    const alreadyHelpful = review.helpful.users.includes(req.user._id);

    if (alreadyHelpful) {
      // Remove helpful mark
      review.helpful.users = review.helpful.users.filter(
        userId => userId.toString() !== req.user._id.toString()
      );
      review.helpful.count = Math.max(0, review.helpful.count - 1);
    } else {
      // Add helpful mark
      review.helpful.users.push(req.user._id);
      review.helpful.count += 1;
    }

    await review.save();

    res.json({
      success: true,
      message: alreadyHelpful ? 'Removed helpful mark' : 'Marked as helpful',
      data: { 
        helpful: { 
          count: review.helpful.count,
          userMarked: !alreadyHelpful 
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

// Report review
const reportReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user already reported
    const alreadyReported = review.reported.users.includes(req.user._id);

    if (!alreadyReported) {
      review.reported.users.push(req.user._id);
      review.reported.count += 1;
      if (reason) {
        review.reported.reasons.push(reason);
      }
    }

    await review.save();

    res.json({
      success: true,
      message: alreadyReported ? 'You have already reported this review' : 'Review reported successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  markHelpful,
  reportReview
};