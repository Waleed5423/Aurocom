const Notification = require('../models/Notification');

// Get user notifications
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;

    const filter = { user: req.user._id };
    if (unreadOnly === 'true') {
      filter.read = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ 
      user: req.user._id, 
      read: false 
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
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

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(req.user._id.toString()).emit('notificationRead', {
      notificationId: notification._id
    });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { 
        user: req.user._id,
        read: false 
      },
      { 
        read: true,
        readAt: new Date()
      }
    );

    // Emit real-time update
    const io = req.app.get('io');
    io.to(req.user._id.toString()).emit('allNotificationsRead');

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Clear all notifications
const clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });

    res.json({
      success: true,
      message: 'All notifications cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get notification preferences (placeholder)
const getPreferences = async (req, res) => {
  try {
    // In a real application, this would come from user preferences
    const preferences = {
      email: {
        orders: true,
        promotions: true,
        security: true,
        system: false
      },
      push: {
        orders: true,
        promotions: false,
        security: true,
        system: true
      },
      inApp: {
        orders: true,
        promotions: true,
        security: true,
        system: true
      }
    };

    res.json({
      success: true,
      data: { preferences }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update notification preferences (placeholder)
const updatePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;

    // In a real application, this would save to user preferences
    // For now, we'll just return the received preferences

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: { preferences }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getPreferences,
  updatePreferences
};