const Product = require('../models/Product');
const Category = require('../models/Category');

class SearchService {
  // Full-text search with filters
  async searchProducts(query, filters = {}) {
    try {
      const {
        page = 1,
        limit = 12,
        category,
        minPrice,
        maxPrice,
        inStock,
        featured,
        rating,
        sortBy = 'relevance',
        sortOrder = 'desc'
      } = filters;

      // Build search query
      let searchQuery = { isActive: true };

      // Text search
      if (query && query.trim() !== '') {
        searchQuery.$text = { $search: query };
      }

      // Category filter
      if (category) {
        // Check if it's a category ID or slug/name
        let categoryFilter;
        if (mongoose.Types.ObjectId.isValid(category)) {
          categoryFilter = { _id: category };
        } else {
          categoryFilter = { 
            $or: [
              { name: { $regex: category, $options: 'i' } },
              { 'seo.slug': category }
            ]
          };
        }

        const categoryDoc = await Category.findOne(categoryFilter);
        if (categoryDoc) {
          // Get all subcategories
          const subcategories = await Category.find({ parent: categoryDoc._id });
          const categoryIds = [categoryDoc._id, ...subcategories.map(sub => sub._id)];
          searchQuery.category = { $in: categoryIds };
        }
      }

      // Price range filter
      if (minPrice !== undefined || maxPrice !== undefined) {
        searchQuery.price = {};
        if (minPrice !== undefined) searchQuery.price.$gte = Number(minPrice);
        if (maxPrice !== undefined) searchQuery.price.$lte = Number(maxPrice);
      }

      // Stock filter
      if (inStock === 'true') {
        searchQuery.$or = [
          { trackQuantity: false },
          { trackQuantity: true, quantity: { $gt: 0 } }
        ];
      }

      // Featured filter
      if (featured === 'true') {
        searchQuery.featured = true;
      }

      // Rating filter
      if (rating) {
        searchQuery['ratings.average'] = { $gte: Number(rating) };
      }

      // Sort options
      let sortOptions = {};
      switch (sortBy) {
        case 'relevance':
          if (query) {
            sortOptions = { score: { $meta: 'textScore' } };
          } else {
            sortOptions = { createdAt: -1 };
          }
          break;
        case 'price':
          sortOptions = { price: sortOrder === 'desc' ? -1 : 1 };
          break;
        case 'name':
          sortOptions = { name: sortOrder === 'desc' ? -1 : 1 };
          break;
        case 'rating':
          sortOptions = { 'ratings.average': sortOrder === 'desc' ? -1 : 1 };
          break;
        case 'popularity':
          sortOptions = { salesCount: sortOrder === 'desc' ? -1 : 1 };
          break;
        case 'newest':
          sortOptions = { createdAt: -1 };
          break;
        default:
          sortOptions = { createdAt: -1 };
      }

      // Execute search
      let productsQuery = Product.find(searchQuery)
        .populate('category', 'name')
        .populate('subcategory', 'name');

      // Add text score for relevance sorting
      if (query && sortBy === 'relevance') {
        productsQuery = productsQuery.select({ score: { $meta: 'textScore' } });
      }

      const products = await productsQuery
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Product.countDocuments(searchQuery);

      // Get search suggestions
      const suggestions = await this.getSearchSuggestions(query);

      return {
        products,
        total,
        suggestions,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get search suggestions
  async getSearchSuggestions(query, limit = 5) {
    if (!query || query.trim() === '') {
      return [];
    }

    try {
      // Search in product names and tags
      const products = await Product.find({
        $text: { $search: query },
        isActive: true
      })
      .select('name tags')
      .limit(limit)
      .sort({ score: { $meta: 'textScore' } });

      // Search in categories
      const categories = await Category.find({
        name: { $regex: query, $options: 'i' },
        isActive: true
      })
      .select('name')
      .limit(limit);

      // Extract unique suggestions
      const suggestions = new Set();

      // Add product names
      products.forEach(product => {
        suggestions.add(product.name);
      });

      // Add product tags
      products.forEach(product => {
        product.tags.forEach(tag => {
          if (tag.toLowerCase().includes(query.toLowerCase())) {
            suggestions.add(tag);
          }
        });
      });

      // Add category names
      categories.forEach(category => {
        suggestions.add(category.name);
      });

      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }

  // Advanced search with facets
  async advancedSearch(filters) {
    try {
      const {
        query,
        categories = [],
        priceRange,
        brands = [],
        ratings = [],
        tags = [],
        page = 1,
        limit = 12,
        sortBy = 'relevance'
      } = filters;

      let searchQuery = { isActive: true };

      // Text search
      if (query) {
        searchQuery.$text = { $search: query };
      }

      // Category filter
      if (categories.length > 0) {
        searchQuery.category = { $in: categories };
      }

      // Price range filter
      if (priceRange && (priceRange.min !== undefined || priceRange.max !== undefined)) {
        searchQuery.price = {};
        if (priceRange.min !== undefined) searchQuery.price.$gte = Number(priceRange.min);
        if (priceRange.max !== undefined) searchQuery.price.$lte = Number(priceRange.max);
      }

      // Brand filter
      if (brands.length > 0) {
        searchQuery.brand = { $in: brands };
      }

      // Rating filter
      if (ratings.length > 0) {
        searchQuery['ratings.average'] = { $in: ratings.map(r => Number(r)) };
      }

      // Tags filter
      if (tags.length > 0) {
        searchQuery.tags = { $in: tags };
      }

      // Sort options
      let sortOptions = {};
      switch (sortBy) {
        case 'relevance':
          if (query) {
            sortOptions = { score: { $meta: 'textScore' } };
          } else {
            sortOptions = { createdAt: -1 };
          }
          break;
        case 'price_low':
          sortOptions = { price: 1 };
          break;
        case 'price_high':
          sortOptions = { price: -1 };
          break;
        case 'rating':
          sortOptions = { 'ratings.average': -1 };
          break;
        case 'popularity':
          sortOptions = { salesCount: -1 };
          break;
        case 'newest':
          sortOptions = { createdAt: -1 };
          break;
        default:
          sortOptions = { createdAt: -1 };
      }

      const products = await Product.find(searchQuery)
        .populate('category', 'name')
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Product.countDocuments(searchQuery);

      // Get search facets
      const facets = await this.getSearchFacets(searchQuery);

      return {
        products,
        total,
        facets,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get search facets for filtering
  async getSearchFacets(baseQuery) {
    try {
      const [
        categoryFacet,
        brandFacet,
        priceFacet,
        ratingFacet
      ] = await Promise.all([
        // Category facet
        Product.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
          { $unwind: '$category' },
          { $project: { name: '$category.name', value: '$_id', count: 1 } }
        ]),

        // Brand facet
        Product.aggregate([
          { $match: { ...baseQuery, brand: { $exists: true, $ne: '' } } },
          { $group: { _id: '$brand', count: { $sum: 1 } } },
          { $project: { name: '$_id', value: '$_id', count: 1 } }
        ]),

        // Price range facet
        Product.aggregate([
          { $match: baseQuery },
          { 
            $bucket: {
              groupBy: '$price',
              boundaries: [0, 25, 50, 100, 200, 500, 1000],
              default: '1000+',
              output: {
                count: { $sum: 1 },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' }
              }
            }
          }
        ]),

        // Rating facet
        Product.aggregate([
          { $match: baseQuery },
          {
            $bucket: {
              groupBy: '$ratings.average',
              boundaries: [1, 2, 3, 4, 5],
              default: 'No Rating',
              output: { count: { $sum: 1 } }
            }
          }
        ])
      ]);

      return {
        categories: categoryFacet,
        brands: brandFacet,
        priceRanges: priceFacet,
        ratings: ratingFacet
      };
    } catch (error) {
      console.error('Error getting search facets:', error);
      return {
        categories: [],
        brands: [],
        priceRanges: [],
        ratings: []
      };
    }
  }
}

module.exports = new SearchService();