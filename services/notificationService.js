const Notification = require("../models/Notification");

class NotificationService {
  async createNotification(userId, type, title, message, data = {}) {
    try {
      const notification = await Notification.create({
        user: userId,
        type,
        title,
        message,
        data,
      });

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  async sendRealTimeNotification(io, userId, notification) {
    try {
      io.to(userId.toString()).emit("newNotification", notification);
    } catch (error) {
      console.error("Error sending real-time notification:", error);
    }
  }

  async sendOrderNotification(io, userId, order, status) {
    const messages = {
      confirmed: "Your order has been confirmed and is being processed.",
      processing: "Your order is being processed and will be shipped soon.",
      shipped: "Your order has been shipped! Track your package.",
      delivered:
        "Your order has been delivered. Thank you for shopping with us!",
      cancelled: "Your order has been cancelled.",
    };

    if (messages[status]) {
      const notification = await this.createNotification(
        userId,
        "order",
        `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        messages[status],
        { orderId: order._id, orderNumber: order.orderNumber }
      );

      this.sendRealTimeNotification(io, userId, notification);
    }
  }
}

module.exports = new NotificationService();
