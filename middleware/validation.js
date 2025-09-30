const { body, validationResult } = require('express-validator');
// Validation rules
const validationRules = {
  register: [
    body('name').notEmpty().withMessage('Name is required').isLength({ max: 50 }).withMessage('Name too long'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number required')
  ],
  
  login: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  
  forgotPassword: [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  
  resetPassword: [
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  
  product: [
    body('name').notEmpty().withMessage('Product name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('category').isMongoId().withMessage('Valid category is required')
  ],
  
  review: [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').notEmpty().withMessage('Comment is required'),
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    body('orderId').isMongoId().withMessage('Valid order ID is required')
  ]
};

// Validation middleware
const validate = (rules) => {
  return [
    ...validationRules[rules] || [],
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }
      next();
    }
  ];
};

module.exports = {
  validate,
  validationRules
};