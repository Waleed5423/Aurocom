module.exports = {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    environment: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox'
  };