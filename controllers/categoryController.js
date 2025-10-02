const Category = require('../models/Category');
const Product = require('../models/Product');

// Get all categories
const getCategories = async (req, res) => {
  try {
    const { includeInactive, featured , flat} = req.query;

    const filter = {};
    if (includeInactive !== 'true') {
      filter.isActive = true;
    }
    if (featured === 'true') {
      filter.featured = true;
    }

    const categories = await Category.find(filter)
      .populate('parent', 'name')
      .sort({ name: 1 });

    // Build nested category structure
    const buildNestedCategories = (categories, parentId = null) => {
      return categories
        .filter(category => 
          (category.parent && category.parent._id.toString() === parentId?.toString()) || 
          (!category.parent && !parentId)
        )
        .map(category => ({
          ...category.toObject(),
          subcategories: buildNestedCategories(categories, category._id)
        }));
    };
    if (flat === 'true') {
      // Return flat list for admin
      const flatCategories = await Category.find(filter)
        .populate('parent', 'name')
        .sort({ name: 1 });
      return res.json({ success: true, data: { categories: flatCategories } });
    }

    const nestedCategories = buildNestedCategories(categories);

    res.json({
      success: true,
      data: { categories: nestedCategories }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single category
const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name')
      .populate('subcategories', 'name description image isActive');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get category products count
    const productsCount = await Product.countDocuments({
      category: category._id,
      isActive: true
    });

    res.json({
      success: true,
      data: { 
        category: {
          ...category.toObject(),
          productsCount
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

// Create category (Admin)
const createCategory = async (req, res) => {
  try {
    const { name, description, parent, featured } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    // Validate parent category if provided
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }
    }

    const categoryData = {
      name,
      description,
      parent,
      featured
    };

    // Handle image upload
    if (req.file) {
      categoryData.image = {
        public_id: req.file.public_id,
        url: req.file.url
      };
    }

    const category = await Category.create(categoryData);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update category (Admin)
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if name is being updated and if it already exists
    if (req.body.name && req.body.name !== category.name) {
      const existingCategory = await Category.findOne({ name: req.body.name });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }

    // Validate parent category if provided
    if (req.body.parent) {
      if (req.body.parent === category._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Category cannot be its own parent'
        });
      }

      const parentCategory = await Category.findById(req.body.parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }
    }

    // Handle image upload
    if (req.file) {
      // Delete old image if exists
      if (category.image && category.image.public_id) {
        const { deleteImage } = require('../middleware/upload');
        await deleteImage(category.image.public_id);
      }

      category.image = {
        public_id: req.file.public_id,
        url: req.file.url
      };
    }

    Object.keys(req.body).forEach(key => {
      if (key !== 'image') {
        category[key] = req.body[key];
      }
    });

    await category.save();

    const updatedCategory = await Category.findById(category._id)
      .populate('parent', 'name')
      .populate('subcategories', 'name');

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category: updatedCategory }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete category (Admin)
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products
    const productsCount = await Product.countDocuments({ category: category._id });
    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with associated products'
      });
    }

    // Check if category has subcategories
    const subcategoriesCount = await Category.countDocuments({ parent: category._id });
    if (subcategoriesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories'
      });
    }

    // Delete image from Cloudinary
    if (category.image && category.image.public_id) {
      const { deleteImage } = require('../middleware/upload');
      await deleteImage(category.image.public_id);
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle category status (Admin)
const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { category }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get category products
const getCategoryProducts = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 12, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Get category and all its subcategories
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const subcategories = await Category.find({ parent: categoryId });
    const categoryIds = [categoryId, ...subcategories.map(sub => sub._id)];

    const filter = {
      category: { $in: categoryIds },
      isActive: true
    };

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const products = await Product.find(filter)
      .populate('category', 'name')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: {
        category,
        products,
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

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryProducts
};