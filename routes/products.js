const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts
} = require('../controllers/productController');
const { auth, optionalAuth } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/:id', optionalAuth, getProduct);

// Admin routes
router.post('/', auth, adminAuth, upload.array('images', 10), createProduct);
router.put('/:id', auth, adminAuth, upload.array('images', 10), updateProduct);
router.delete('/:id', auth, adminAuth, deleteProduct);

module.exports = router;