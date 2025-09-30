const { auth } = require('./auth');

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }
      next();
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

const superAdminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Super admin privileges required.'
        });
      }
      next();
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

module.exports = { adminAuth, superAdminAuth };