module.exports = {
  merchantId: process.env.JAZZCASH_MERCHANT_ID,
  password: process.env.JAZZCASH_PASSWORD,
  salt: process.env.JAZZCASH_SALT,
  environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
};
