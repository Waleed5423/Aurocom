// routes/upload.js
const express = require('express');
const { upload } = require('../middleware/upload');
const router = express.Router();

// Single file upload
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  res.json({
    success: true,
    data: {
      public_id: req.file.public_id,
      url: req.file.url,
      format: req.file.format,
      bytes: req.file.size,
      width: req.file.width,
      height: req.file.height,
    }
  });
});

// Multiple file upload
router.post('/upload-multiple', upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded' });
  }
  const data = req.files.map(file => ({
    public_id: file.public_id,
    url: file.url,
    format: file.format,
    bytes: file.size,
    width: file.width,
    height: file.height,
  }));
  res.json({
    success: true,
    data
  });
});

module.exports = router;