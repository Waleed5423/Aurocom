const Notification = require('../models/Notification');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join user to their personal room
    socket.on('joinUser', (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });

    // Handle order status updates
    socket.on('orderStatusUpdate', (data) => {
      const { orderId, userId, status } = data;
      socket.to(userId).emit('orderStatusChanged', {
        orderId,
        status,
        timestamp: new Date()
      });
    });

    // Handle notifications
    socket.on('markNotificationRead', async (notificationId) => {
      try {
        await Notification.findByIdAndUpdate(notificationId, {
          read: true
        });
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};