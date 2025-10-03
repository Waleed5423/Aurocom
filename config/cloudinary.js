// config/cloudinary.js - CORRECT
const cloudinary = require("cloudinary").v2;

console.log("🔧 Initializing Cloudinary...");
console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test the configuration
cloudinary.api
  .ping()
  .then((result) => {
    console.log("✅ Cloudinary configuration successful - API is responsive");
  })
  .catch((error) => {
    console.error("❌ Cloudinary configuration failed:", error.message);
    console.error("Full error:", error);
  });

module.exports = cloudinary;
