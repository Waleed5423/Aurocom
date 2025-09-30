const Coupon = require('../models/Coupon');

// Get all coupons (Admin)
const getCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, active } = req.query;
    
    const filter = {};
    if (active === 'true') {
      filter.isActive = true;
      filter.expiresAt = { $gt: new Date() };
    } else if (active === 'false') {
      filter.$or = [
        { isActive: false },
        { expiresAt: { $lte: new Date() } }
      ];
    }

    const coupons = await Coupon.find(filter)
      .populate('applicableCategories', 'name')
      .populate('excludedProducts', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Coupon.countDocuments(filter);

    res.json({
      success: true,
      data: {
        coupons,
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

// Get single coupon
const getCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('applicableCategories', 'name')
      .populate('excludedProducts', 'name')
      .populate('createdBy', 'name');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.json({
      success: true,
      data: { coupon }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create coupon (Admin)
const createCoupon = async (req, res) => {
  try {
    const couponData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: couponData.code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    const coupon = await Coupon.create(couponData);

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: { coupon }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update coupon (Admin)
const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Prevent updating code if already used
    if (req.body.code && coupon.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update code of a used coupon'
      });
    }

    Object.keys(req.body).forEach(key => {
      coupon[key] = req.body[key];
    });

    await coupon.save();

    const updatedCoupon = await Coupon.findById(coupon._id)
      .populate('applicableCategories', 'name')
      .populate('excludedProducts', 'name')
      .populate('createdBy', 'name');

    res.json({
      success: true,
      message: 'Coupon updated successfully',
      data: { coupon: updatedCoupon }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete coupon (Admin)
const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    if (coupon.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a coupon that has been used'
      });
    }

    await Coupon.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Validate coupon (Public)
const validateCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      expiresAt: { $gt: new Date() }
    });

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired coupon'
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached'
      });
    }

    // Check minimum order value
    if (coupon.minOrderValue && cartTotal < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of $${coupon.minOrderValue} required`
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (cartTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.discountValue;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        coupon: {
          id: coupon._id,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          maxDiscount: coupon.maxDiscount,
          discount,
          description: coupon.description
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

// Increment coupon usage
const incrementCouponUsage = async (couponId) => {
  try {
    await Coupon.findByIdAndUpdate(couponId, {
      $inc: { usedCount: 1 }
    });
  } catch (error) {
    console.error('Error incrementing coupon usage:', error);
  }
};

module.exports = {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  incrementCouponUsage
};