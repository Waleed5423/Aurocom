const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send email
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Aurocom" <${process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
    };

    if (options.text) {
      mailOptions.text = options.text;
    }

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  welcome: (user) => ({
    subject: 'Welcome to Aurocom!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Aurocom, ${user.name}!</h2>
        <p>Thank you for registering with us. We're excited to have you on board!</p>
        <p>Start exploring our products and enjoy a seamless shopping experience.</p>
        <a href="${process.env.CLIENT_URL}/products" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
          Start Shopping
        </a>
        <p>If you have any questions, feel free to contact our support team.</p>
      </div>
    `
  }),

  orderConfirmation: (order, user) => ({
    subject: `Order Confirmation - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Confirmed!</h2>
        <p>Thank you for your order, ${user.name}!</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order Number:</strong> ${order.orderNumber}</p>
          <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <p><strong>Total Amount:</strong> $${order.total.toFixed(2)}</p>
        </div>

        <div style="margin: 20px 0;">
          <h3>Shipping Address</h3>
          <p>${order.shippingAddress.name}<br>
          ${order.shippingAddress.street}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}<br>
          ${order.shippingAddress.country}</p>
        </div>

        <a href="${process.env.CLIENT_URL}/orders/${order._id}" 
           style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Order Details
        </a>
      </div>
    `
  }),

  orderShipped: (order, user, trackingInfo) => ({
    subject: `Your Order Has Shipped! - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your Order is on the Way!</h2>
        <p>Great news, ${user.name}! Your order has been shipped.</p>
        
        <div style="background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Shipping Information</h3>
          <p><strong>Tracking Number:</strong> ${trackingInfo.trackingNumber}</p>
          <p><strong>Carrier:</strong> ${trackingInfo.carrier}</p>
          ${trackingInfo.estimatedDelivery ? 
            `<p><strong>Estimated Delivery:</strong> ${trackingInfo.estimatedDelivery}</p>` : ''}
        </div>

        ${trackingInfo.trackingUrl ? `
          <a href="${trackingInfo.trackingUrl}" 
             style="background-color: #17a2b8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">
            Track Your Package
          </a>
        ` : ''}

        <a href="${process.env.CLIENT_URL}/orders/${order._id}" 
           style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-left: 10px;">
          View Order
        </a>
      </div>
    `
  })
};

// Send template email
const sendTemplateEmail = async (to, templateName, data) => {
  const template = emailTemplates[templateName];
  if (!template) {
    throw new Error(`Email template '${templateName}' not found`);
  }

  const emailContent = template(data.user || data, data);
  
  return await sendEmail({
    email: to,
    subject: emailContent.subject,
    html: emailContent.html
  });
};

module.exports = {
  sendEmail,
  sendTemplateEmail,
  emailTemplates
};