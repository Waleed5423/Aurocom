const cloudinary = require('../config/cloudinary');
const { deleteImage } = require('../middleware/upload');

class FileUploadService {
  // Upload single image
  async uploadImage(file, folder = 'aurocom') {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: folder,
        transformation: [
          { width: 1000, height: 1000, crop: 'limit', quality: 'auto' }
        ]
      });

      return {
        public_id: result.public_id,
        url: result.secure_url,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height
      };
    } catch (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  // Upload multiple images
  async uploadImages(files, folder = 'aurocom') {
    try {
      const uploadPromises = files.map(file => this.uploadImage(file, folder));
      const results = await Promise.all(uploadPromises);

      return results;
    } catch (error) {
      throw new Error(`Multiple image upload failed: ${error.message}`);
    }
  }

  // Delete image
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      
      if (result.result !== 'ok') {
        throw new Error(`Failed to delete image: ${result.result}`);
      }

      return result;
    } catch (error) {
      throw new Error(`Image deletion failed: ${error.message}`);
    }
  }

  // Delete multiple images
  async deleteImages(publicIds) {
    try {
      const deletePromises = publicIds.map(publicId => this.deleteImage(publicId));
      const results = await Promise.all(deletePromises);

      return results;
    } catch (error) {
      throw new Error(`Multiple image deletion failed: ${error.message}`);
    }
  }

  // Upload product images with variants
  async uploadProductImages(files, productId) {
    try {
      const folder = `aurocom/products/${productId}`;
      const results = await this.uploadImages(files, folder);

      return results.map((result, index) => ({
        ...result,
        isDefault: index === 0 // First image is default
      }));
    } catch (error) {
      throw error;
    }
  }

  // Upload user avatar
  async uploadAvatar(file, userId) {
    try {
      const folder = `aurocom/users/${userId}/avatar`;
      const result = await this.uploadImage(file, folder);

      return result;
    } catch (error) {
      throw error;
    }
  }

  // Upload category image
  async uploadCategoryImage(file, categoryId) {
    try {
      const folder = `aurocom/categories/${categoryId}`;
      const result = await this.uploadImage(file, folder);

      return result;
    } catch (error) {
      throw error;
    }
  }

  // Upload review images
  async uploadReviewImages(files, reviewId) {
    try {
      const folder = `aurocom/reviews/${reviewId}`;
      const results = await this.uploadImages(files, folder);

      return results;
    } catch (error) {
      throw error;
    }
  }

  // Generate image URL with transformations
  generateImageUrl(publicId, transformations = {}) {
    const {
      width = 500,
      height = 500,
      crop = 'fill',
      quality = 'auto',
      format = 'auto'
    } = transformations;

    return cloudinary.url(publicId, {
      width,
      height,
      crop,
      quality,
      format,
      secure: true
    });
  }

  // Optimize image for web
  optimizeForWeb(publicId, width = 800) {
    return this.generateImageUrl(publicId, {
      width,
      height: width,
      crop: 'limit',
      quality: 'auto',
      format: 'webp'
    });
  }

  // Create image thumbnail
  createThumbnail(publicId, size = 150) {
    return this.generateImageUrl(publicId, {
      width: size,
      height: size,
      crop: 'fill',
      quality: 'auto',
      format: 'webp'
    });
  }
}

module.exports = new FileUploadService();