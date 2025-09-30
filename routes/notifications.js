const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getPreferences,
  updatePreferences
} = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);
router.delete('/', clearAllNotifications);
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

module.exports = router;