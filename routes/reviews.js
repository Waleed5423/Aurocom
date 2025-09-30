const express = require('express');
const {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  markHelpful,
  reportReview
} = require('../controllers/reviewController');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/product/:productId', optionalAuth, getProductReviews);

// Protected routes
router.use(auth);
router.post('/', createReview);
router.put('/:id', updateReview);
router.delete('/:id', deleteReview);
router.post('/:id/helpful', markHelpful);
router.post('/:id/report', reportReview);

module.exports = router;