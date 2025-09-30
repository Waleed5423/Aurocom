const User = require("../models/User");
const { generateToken, generateRefreshToken } = require("../utils/jwt");
const { sendTemplateEmail } = require("./emailService");

class AuthService {
  // Register new user
  async register(userData) {
    try {
      const { name, email, password, phone } = userData;

      // Check if user exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error("User already exists with this email");
      }

      // Create user
      const user = await User.create({
        name,
        email,
        password,
        phone,
      });

      // Generate tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Send welcome email
      try {
        await sendTemplateEmail(user.email, "welcome", { user });
      } catch (emailError) {
        console.log("Welcome email failed:", emailError);
        // Don't throw error, registration should still succeed
      }

      return {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
        refreshToken,
      };
    } catch (error) {
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      // Check if user exists and password is correct
      const user = await User.findOne({ email }).select("+password");
      if (!user || !(await user.comparePassword(password))) {
        throw new Error("Invalid email or password");
      }

      if (!user.isActive) {
        throw new Error("Account has been deactivated");
      }

      // Generate tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      return {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
        token,
        refreshToken,
      };
    } catch (error) {
      throw error;
    }
  }

  // Verify email
  async verifyEmail(token) {
    try {
      const crypto = require("crypto");
      const emailVerifyToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const user = await User.findOne({
        emailVerifyToken,
        emailVerifyExpire: { $gt: Date.now() },
      });

      if (!user) {
        throw new Error("Invalid or expired verification token");
      }

      user.emailVerified = true;
      user.emailVerifyToken = undefined;
      user.emailVerifyExpire = undefined;
      await user.save();

      return { message: "Email verified successfully" };
    } catch (error) {
      throw error;
    }
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select("+password");

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(
        currentPassword
      );
      if (!isCurrentPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Send password change notification email
      try {
        await sendTemplateEmail(user.email, "passwordChanged", { user });
      } catch (emailError) {
        console.log("Password change notification email failed:", emailError);
      }

      return { message: "Password changed successfully" };
    } catch (error) {
      throw error;
    }
  }

  // Update profile
  async updateProfile(userId, updateData) {
    try {
      const allowedUpdates = ["name", "phone", "avatar"];
      const updates = Object.keys(updateData);
      const isValidOperation = updates.every((update) =>
        allowedUpdates.includes(update)
      );

      if (!isValidOperation) {
        throw new Error("Invalid updates");
      }

      const user = await User.findById(userId);
      updates.forEach((update) => (user[update] = updateData[update]));
      await user.save();

      const sanitizedUser = {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
      };

      return { user: sanitizedUser };
    } catch (error) {
      throw error;
    }
  }

  // Logout (client-side token removal)
  async logout() {
    // In a blacklist implementation, you would add the token to a blacklist here
    // For JWT, since they're stateless, we rely on client-side token removal
    return { message: "Logged out successfully" };
  }
}

module.exports = new AuthService();
