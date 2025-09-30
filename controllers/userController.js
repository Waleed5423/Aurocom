const User = require("../models/User");
const Order = require("../models/Order");
const Review = require("../models/Review");
const { sanitizeUser } = require("../utils/helpers");

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -resetPasswordToken -resetPasswordExpire"
    );

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;

    await user.save();

    const sanitizedUser = sanitizeUser(user);

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user: sanitizedUser },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Manage addresses
const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("addresses");

    res.json({
      success: true,
      data: { addresses: user.addresses },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const addAddress = async (req, res) => {
  try {
    const { name, street, city, state, zipCode, country, isDefault } = req.body;

    const user = await User.findById(req.user._id);

    const newAddress = {
      name,
      street,
      city,
      state,
      zipCode,
      country,
      isDefault: isDefault || false,
    };

    // If setting as default, remove default from other addresses
    if (isDefault) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: { addresses: user.addresses },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { name, street, city, state, zipCode, country, isDefault } = req.body;

    const user = await User.findById(req.user._id);

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    if (name) address.name = name;
    if (street) address.street = street;
    if (city) address.city = city;
    if (state) address.state = state;
    if (zipCode) address.zipCode = zipCode;
    if (country) address.country = country;

    // If setting as default, remove default from other addresses
    if (isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = addr._id.toString() === addressId;
      });
    } else if (address.isDefault) {
      // Prevent removing default without setting another one
      const hasOtherDefault = user.addresses.some(
        (addr) => addr._id.toString() !== addressId && addr.isDefault
      );
      if (!hasOtherDefault) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot remove default address without setting another one as default",
        });
      }
    }

    await user.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      data: { addresses: user.addresses },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user._id);

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Prevent deleting default address
    if (address.isDefault) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete default address",
      });
    }

    user.addresses.pull(addressId);
    await user.save();

    res.json({
      success: true,
      message: "Address deleted successfully",
      data: { addresses: user.addresses },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Wishlist management
const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "wishlist",
      "name images price ratings featured isActive"
    );

    const activeWishlist = user.wishlist.filter((product) => product.isActive);

    res.json({
      success: true,
      data: { wishlist: activeWishlist },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    const user = await User.findById(req.user._id);

    // Check if product already in wishlist
    if (user.wishlist.includes(productId)) {
      return res.status(400).json({
        success: false,
        message: "Product already in wishlist",
      });
    }

    user.wishlist.push(productId);
    await user.save();

    const updatedUser = await User.findById(req.user._id).populate(
      "wishlist",
      "name images price ratings featured isActive"
    );

    res.json({
      success: true,
      message: "Product added to wishlist",
      data: { wishlist: updatedUser.wishlist },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user._id);

    user.wishlist.pull(productId);
    await user.save();

    const updatedUser = await User.findById(req.user._id).populate(
      "wishlist",
      "name images price ratings featured isActive"
    );

    res.json({
      success: true,
      message: "Product removed from wishlist",
      data: { wishlist: updatedUser.wishlist },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const [ordersCount, reviewsCount, wishlistCount] = await Promise.all([
      Order.countDocuments({ user: req.user._id }),
      Review.countDocuments({ user: req.user._id, isActive: true }),
      User.findById(req.user._id)
        .select("wishlist")
        .then((user) => user.wishlist.length),
    ]);

    // Get recent orders
    const recentOrders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("orderNumber status total createdAt");

    res.json({
      success: true,
      data: {
        stats: {
          orders: ordersCount,
          reviews: reviewsCount,
          wishlist: wishlistCount,
        },
        recentOrders,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getDashboardStats,
};
