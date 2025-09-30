const express = require("express");
const {
  getDashboardStats,
  getUsers,
  updateUserStatus,
  updateUserRole,
  getAllOrders,
  updateOrderStatus,
  getAllProducts,
  updateProductStatus,
  updateProductInventory,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllReviews,
  updateReviewStatus,
  getSalesReport,
  getProductPerformance,
  getAllTransactions,
  processRefund,
  getLowStockProducts,
  bulkUpdateInventory,
} = require("../controllers/adminController");
const { adminAuth, superAdminAuth } = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.use(adminAuth);

// Dashboard
router.get("/dashboard", getDashboardStats);

// User management
router.get("/users", getUsers);
router.patch("/users/:id/status", updateUserStatus);
router.patch("/users/:id/role", superAdminAuth, updateUserRole);

// Order management
router.get("/orders", getAllOrders);
router.patch("/orders/:id/status", updateOrderStatus);

// Product management
router.get("/products", getAllProducts);
router.patch("/products/:id/status", updateProductStatus);
router.patch("/products/:id/inventory", updateProductInventory);

// Category management
router.post("/categories", upload.single("image"), createCategory);
router.put("/categories/:id", upload.single("image"), updateCategory);
router.delete("/categories/:id", deleteCategory);

// Review management
router.get("/reviews", getAllReviews);
router.patch("/reviews/:id/status", updateReviewStatus);

// Analytics and reports
router.get("/analytics/sales", getSalesReport);
router.get("/analytics/products", getProductPerformance);

// Coupon management (delegated from couponController)
const couponController = require("../controllers/couponController");
router.get("/coupons", couponController.getCoupons);
router.get("/coupons/:id", couponController.getCoupon);
router.post("/coupons", couponController.createCoupon);
router.put("/coupons/:id", couponController.updateCoupon);
router.delete("/coupons/:id", couponController.deleteCoupon);

// Payment and transaction management
router.get("/transactions", getAllTransactions);
router.post("/transactions/:id/refund", processRefund);

// Inventory management
router.get("/inventory/low-stock", getLowStockProducts);
router.post("/inventory/bulk-update", bulkUpdateInventory);

module.exports = router;
