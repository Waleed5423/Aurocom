const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

// Get user cart
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name images price trackQuantity quantity')
      .populate('coupon');

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    // Check product availability and update cart
    let cartUpdated = false;
    for (let item of cart.items) {
      const product = item.product;
      
      if (!product.isActive) {
        // Remove inactive products
        cart.items = cart.items.filter(i => i.product._id.toString() !== product._id.toString());
        cartUpdated = true;
        continue;
      }

      if (product.trackQuantity && product.quantity < item.quantity) {
        // Adjust quantity if insufficient stock
        if (product.quantity === 0) {
          cart.items = cart.items.filter(i => i.product._id.toString() !== product._id.toString());
        } else {
          item.quantity = product.quantity;
        }
        cartUpdated = true;
      }
    }

    if (cartUpdated) {
      await cart.save();
      cart = await Cart.findById(cart._id)
        .populate('items.product', 'name images price trackQuantity quantity')
        .populate('coupon');
    }

    res.json({
      success: true,
      data: { cart }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, variant } = req.body;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check stock
    if (product.trackQuantity && product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock'
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      cart = await Cart.create({ 
        user: req.user._id, 
        items: [] 
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item => 
      item.product.toString() === productId && 
      JSON.stringify(item.variant) === JSON.stringify(variant)
    );

    let price = product.price;
    
    // Calculate variant price if provided
    if (variant && product.variants && product.variants.length > 0) {
      const variantGroup = product.variants.find(v => v.name === variant.name);
      if (variantGroup) {
        const variantValue = variantGroup.values.find(v => v.value === variant.value);
        if (variantValue) {
          price = variantValue.price;
          
          // Check variant stock
          if (variantValue.stock < quantity) {
            return res.status(400).json({
              success: false,
              message: 'Insufficient stock for selected variant'
            });
          }
        }
      }
    }

    if (existingItemIndex > -1) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      
      if (product.trackQuantity && product.quantity < newQuantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock for requested quantity'
        });
      }
      
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].price = price;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        variant,
        price
      });
    }

    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price trackQuantity quantity')
      .populate('coupon');

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: { cart: updatedCart }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name images price trackQuantity quantity');

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    const product = cartItem.product;
    
    // Check stock
    if (product.trackQuantity && product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock'
      });
    }

    cartItem.quantity = quantity;
    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price trackQuantity quantity')
      .populate('coupon');

    res.json({
      success: true,
      message: 'Cart updated successfully',
      data: { cart: updatedCart }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(item => item._id.toString() !== itemId);
    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price trackQuantity quantity')
      .populate('coupon');

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: { cart: updatedCart }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    cart.coupon = undefined;
    cart.discount = 0;
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: { cart }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Apply coupon
const applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired coupon'
      });
    }

    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'price');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    const subtotal = cart.subtotal;

    // Check minimum order value
    if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of $${coupon.minOrderValue} required`
      });
    }

    // Check usage limits
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached'
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.discountValue;
    }

    cart.coupon = coupon._id;
    cart.discount = discount;
    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price trackQuantity quantity')
      .populate('coupon');

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      data: { cart: updatedCart }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Remove coupon
const removeCoupon = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.coupon = undefined;
    cart.discount = 0;
    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price trackQuantity quantity')
      .populate('coupon');

    res.json({
      success: true,
      message: 'Coupon removed successfully',
      data: { cart: updatedCart }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon
};