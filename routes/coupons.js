const express = require('express');
const {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon
} = require('../controllers/couponController');
const { auth } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// Public route
router.post('/validate', validateCoupon);

// Admin routes
router.use(adminAuth);
router.get('/', getCoupons);
router.get('/:id', getCoupon);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);

module.exports = router;