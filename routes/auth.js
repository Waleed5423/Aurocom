const express = require('express');
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  verifyEmail 
} = require('../controllers/authController');
const { validate } = require('../middleware/validation');

const router = express.Router();

router.post('/register', validate('register'), register);
router.post('/login', validate('login'), login);
router.post('/forgot-password', validate('forgotPassword'), forgotPassword);
router.post('/reset-password', validate('resetPassword'), resetPassword);
router.post('/refresh-token', refreshToken);
router.get('/verify-email', verifyEmail);

module.exports = router;