// Generate random string
const generateRandomString = (length = 8) => {
  return Math.random().toString(36).substring(2, 2 + length);
};

// Format currency
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

// Calculate pagination
const calculatePagination = (page, limit, total) => {
  const currentPage = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.max(1, parseInt(limit) || 10);
  const totalPages = Math.ceil(total / pageSize);
  const skip = (currentPage - 1) * pageSize;

  return {
    current: currentPage,
    pages: totalPages,
    total,
    skip,
    limit: pageSize
  };
};

// Sanitize user data
const sanitizeUser = (user) => {
  const userObject = user.toObject ? user.toObject() : user;
  const { password, resetPasswordToken, resetPasswordExpire, ...sanitized } = userObject;
  return sanitized;
};

// Generate order number
const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `ORD-${timestamp}-${random}`;
};

// Validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  generateRandomString,
  formatCurrency,
  calculatePagination,
  sanitizeUser,
  generateOrderNumber,
  isValidEmail,
  delay
};