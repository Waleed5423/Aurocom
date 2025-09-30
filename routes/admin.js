const express = require('express');
const {
  getDashboardStats,
  getUsers,
  updateUserStatus
} = require('../controllers/adminController');
const { adminAuth, superAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

router.use(adminAuth);

// Dashboard
router.get('/dashboard', getDashboardStats);

// User management
router.get('/users', getUsers);
router.patch('/users/:id/status', updateUserStatus);

// Product management (delegated to product routes with admin auth)
// Order management (delegated to order routes with admin auth)
// Category management (delegated to category routes with admin auth)
// Coupon management (delegated to coupon routes with admin auth)

module.exports = router;