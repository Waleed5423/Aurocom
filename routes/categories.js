const express = require('express');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryProducts
} = require('../controllers/categoryController');
const { auth, optionalAuth } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getCategories);
router.get('/:id', optionalAuth, getCategory);
router.get('/:categoryId/products', optionalAuth, getCategoryProducts);

// Admin routes
router.use(auth, adminAuth);
router.post('/', upload.single('image'), createCategory);
router.put('/:id', upload.single('image'), updateCategory);
router.delete('/:id', deleteCategory);
router.patch('/:id/toggle-status', toggleCategoryStatus);

module.exports = router;