module.exports = {
    storeId: process.env.EASYPAISA_STORE_ID,
    hashKey: process.env.EASYPAISA_HASH_KEY,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
  };