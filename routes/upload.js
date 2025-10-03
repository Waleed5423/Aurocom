// routes/upload.js - CLEAN VERSION
const express = require("express");
const { upload, handleUploadError } = require("../middleware/upload");
const router = express.Router();

// Use upload error handling middleware
router.use(handleUploadError);

// Single file upload
router.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    console.log("✅ File uploaded successfully:", {
      originalname: req.file.originalname,
      public_id: req.file.public_id,
      url: req.file.url,
    });

    res.json({
      success: true,
      data: {
        public_id: req.file.public_id,
        url: req.file.url,
        format: req.file.format,
        bytes: req.file.size,
        width: req.file.width,
        height: req.file.height,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Upload failed: " + error.message,
    });
  }
});

// Multiple file upload
router.post("/upload-multiple", upload.array("files", 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded" });
    }

    const data = req.files.map((file) => ({
      public_id: file.public_id,
      url: file.url,
      format: file.format,
      bytes: file.size,
      width: file.width,
      height: file.height,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Multiple upload error:", error);
    res.status(500).json({
      success: false,
      message: "Upload failed: " + error.message,
    });
  }
});

module.exports = router;
