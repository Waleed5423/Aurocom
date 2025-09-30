const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon
} = require('../controllers/cartController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/item/:itemId', updateCartItem);
router.delete('/item/:itemId', removeFromCart);
router.delete('/clear', clearCart);
router.post('/coupon/apply', applyCoupon);
router.delete('/coupon/remove', removeCoupon);

module.exports = router;