const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Category = require("../models/Category");
const Coupon = require("../models/Coupon");
const Review = require("../models/Review");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Payment = require("../models/Payment");
// Dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      recentOrders,
      lowStockProducts,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: "completed" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Order.find()
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .limit(10),
      Product.find({
        trackQuantity: true,
        quantity: { $lte: 10 },
        isActive: true,
      }).limit(10),
    ]);

    // Sales data for chart (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          paymentStatus: "completed",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          totalSales: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          lowStockCount: lowStockProducts.length,
        },
        recentOrders,
        lowStockProducts,
        salesData,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// User management
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["customer", "admin", "super_admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: `User role updated to ${role} successfully`,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Order management
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "shippingAddress.name": { $regex: search, $options: "i" } },
        { "shippingAddress.email": { $regex: search, $options: "i" } },
      ];
    }

    const orders = await Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, carrier } = req.body;

    const order = await Order.findById(id).populate("user");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (carrier) order.carrier = carrier;

    if (status === "delivered") {
      order.deliveredAt = new Date();
    }

    await order.save();

    // Send real-time notification
    const io = req.app.get("io");
    const notificationService = require("../services/notificationService");
    await notificationService.sendOrderNotification(
      io,
      order.user._id,
      order,
      status
    );

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: { order },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Product management
const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      featured,
      status,
    } = req.query;

    const filter = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (category) {
      filter.category = category;
    }

    if (featured === "true") {
      filter.featured = true;
    }

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "inactive") {
      filter.isActive = false;
    }

    const products = await Product.find(filter)
      .populate("category", "name")
      .populate("subcategory", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, featured } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (isActive !== undefined) product.isActive = isActive;
    if (featured !== undefined) product.featured = featured;

    await product.save();

    res.json({
      success: true,
      message: "Product updated successfully",
      data: { product },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateProductInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, lowStockAlert, trackQuantity } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (quantity !== undefined) product.quantity = quantity;
    if (lowStockAlert !== undefined) product.lowStockAlert = lowStockAlert;
    if (trackQuantity !== undefined) product.trackQuantity = trackQuantity;

    await product.save();

    res.json({
      success: true,
      message: "Product inventory updated successfully",
      data: { product },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Category management
const createCategory = async (req, res) => {
  try {
    const { name, description, parent, featured } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    // Validate parent category if provided
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    const categoryData = {
      name,
      description,
      parent,
      featured,
    };

    // Handle image upload
    if (req.file) {
      categoryData.image = {
        public_id: req.file.public_id,
        url: req.file.url,
      };
    }

    const category = await Category.create(categoryData);

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: { category },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, featured, isActive } = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if name is being updated and if it already exists
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }
      category.name = name;
    }

    if (description !== undefined) category.description = description;
    if (featured !== undefined) category.featured = featured;
    if (isActive !== undefined) category.isActive = isActive;

    // Handle image upload
    if (req.file) {
      // Delete old image if exists
      if (category.image && category.image.public_id) {
        const { deleteImage } = require("../middleware/upload");
        await deleteImage(category.image.public_id);
      }

      category.image = {
        public_id: req.file.public_id,
        url: req.file.url,
      };
    }

    await category.save();

    const updatedCategory = await Category.findById(category._id).populate(
      "parent",
      "name"
    );

    res.json({
      success: true,
      message: "Category updated successfully",
      data: { category: updatedCategory },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category has products
    const productsCount = await Product.countDocuments({ category: id });
    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with associated products",
      });
    }

    // Check if category has subcategories
    const subcategoriesCount = await Category.countDocuments({ parent: id });
    if (subcategoriesCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with subcategories",
      });
    }

    // Delete image from Cloudinary
    if (category.image && category.image.public_id) {
      const { deleteImage } = require("../middleware/upload");
      await deleteImage(category.image.public_id);
    }

    await Category.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Review management
const getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, rating, productId } = req.query;

    const filter = {};

    if (status === "approved") {
      filter.isApproved = true;
    } else if (status === "pending") {
      filter.isApproved = false;
    }

    if (rating) {
      filter.rating = Number(rating);
    }

    if (productId) {
      filter.product = productId;
    }

    const reviews = await Review.find(filter)
      .populate("user", "name email")
      .populate("product", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(filter);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved, adminResponse } = req.body;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (isApproved !== undefined) review.isApproved = isApproved;

    if (adminResponse) {
      review.adminResponse = {
        comment: adminResponse,
        respondedBy: req.user._id,
        respondedAt: new Date(),
      };
    }

    await review.save();

    // Update product ratings
    await Review.updateProductRatings(review.product);

    const updatedReview = await Review.findById(id)
      .populate("user", "name email")
      .populate("product", "name")
      .populate("adminResponse.respondedBy", "name");

    res.json({
      success: true,
      message: "Review updated successfully",
      data: { review: updatedReview },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Analytics and reports
const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    const matchStage = {
      paymentStatus: "completed",
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    let groupStage = {};
    if (groupBy === "day") {
      groupStage = {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
      };
    } else if (groupBy === "month") {
      groupStage = {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
      };
    } else if (groupBy === "year") {
      groupStage = {
        _id: {
          year: { $year: "$createdAt" },
        },
      };
    }

    const salesReport = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          ...groupStage,
          totalSales: { $sum: "$total" },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: "$total" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    res.json({
      success: true,
      data: { salesReport },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getProductPerformance = async (req, res) => {
  try {
    const { period = "30days" } = req.query;

    const days = parseInt(period) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const productPerformance = await Order.aggregate([
      {
        $match: {
          paymentStatus: "completed",
          createdAt: { $gte: startDate },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          productName: { $first: "$items.name" },
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] },
          },
          orderCount: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          productName: 1,
          totalSold: 1,
          totalRevenue: 1,
          orderCount: { $size: "$orderCount" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 20 },
    ]);

    // Populate product details
    const populatedPerformance = await Product.populate(productPerformance, {
      path: "_id",
      select: "name images category",
    });

    res.json({
      success: true,
      data: { productPerformance: populatedPerformance },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentMethod,
      startDate,
      endDate,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate("user", "name email")
      .populate("order", "orderNumber total")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(filter);

    // Get transaction statistics
    const stats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        stats,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { refundAmount, refundReason } = req.body;

    const transaction = await Transaction.findById(id)
      .populate("order")
      .populate("user");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Can only refund completed transactions",
      });
    }

    const refundValue = refundAmount || transaction.amount;

    if (refundValue > transaction.amount) {
      return res.status(400).json({
        success: false,
        message: "Refund amount cannot exceed transaction amount",
      });
    }

    // Update transaction
    transaction.status = "refunded";
    transaction.refundAmount = refundValue;
    transaction.refundReason = refundReason;
    transaction.refundedAt = new Date();
    await transaction.save();

    // Update order status if full refund
    if (refundValue === transaction.amount) {
      await Order.findByIdAndUpdate(transaction.order._id, {
        paymentStatus: "refunded",
        status: "cancelled",
      });
    }

    // Send refund notification
    const io = req.app.get("io");
    const notificationService = require("../services/notificationService");
    await notificationService.createNotification(
      transaction.user._id,
      "payment",
      "Payment Refunded",
      `Your payment of $${refundValue} has been refunded.`,
      { transactionId: transaction._id, orderId: transaction.order._id }
    );

    res.json({
      success: true,
      message: "Refund processed successfully",
      data: { transaction },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Inventory management
const getLowStockProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const lowStockProducts = await Product.find({
      trackQuantity: true,
      quantity: { $lte: 10 },
      isActive: true,
    })
      .populate("category", "name")
      .sort({ quantity: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments({
      trackQuantity: true,
      quantity: { $lte: 10 },
      isActive: true,
    });

    res.json({
      success: true,
      data: {
        products: lowStockProducts,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const bulkUpdateInventory = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { productId, quantity, lowStockAlert }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No updates provided",
      });
    }

    const bulkOperations = updates.map((update) => ({
      updateOne: {
        filter: { _id: update.productId },
        update: {
          $set: {
            quantity: update.quantity,
            lowStockAlert: update.lowStockAlert || 5,
          },
        },
      },
    }));

    const result = await Product.bulkWrite(bulkOperations);

    res.json({
      success: true,
      message: "Inventory updated successfully",
      data: { result },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
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
};
