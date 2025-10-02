const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const socketIo = require("socket.io");
const cookieParser = require("cookie-parser");
require("dotenv").config(); 

const app = express();
const server = http.createServer(app);

// Socket.io configuration with error handling
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
  pingTimeout: 60000,
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});

app.use(limiter);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Database connection with better error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/aurocom",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

// Initialize database
connectDB();

// Socket.io with error handling
app.set("io", io);

try {
  require("./sockets/index")(io);
} catch (error) {
  console.error("Socket initialization failed:", error);
}

// Routes with error handling
const routes = [
  { path: "/api/auth", route: require("./routes/auth") },
  { path: "/api/users", route: require("./routes/users") },
  { path: "/api/products", route: require("./routes/products") },
  { path: "/api/categories", route: require("./routes/categories") },
  { path: "/api/cart", route: require("./routes/cart") },
  { path: "/api/orders", route: require("./routes/orders") },
  { path: "/api/payments", route: require("./routes/payments") },
  { path: "/api/coupons", route: require("./routes/coupons") },
  { path: "/api/reviews", route: require("./routes/reviews") },
  { path: "/api/notifications", route: require("./routes/notifications") },
  { path: "/api/admin", route: require("./routes/admin") },
];

routes.forEach(({ path, route }) => {
  app.use(path, route);
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use(require("./middleware/errorHandler"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});
// Global error handler for unhandled rejections
process.on("unhandledRejection", (err, promise) => {
  console.log("Unhandled Rejection at:", promise, "reason:", err);
});

process.on("uncaughtException", (err) => {
  console.log("Uncaught Exception thrown:", err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🔗 Client URL: ${process.env.CLIENT_URL || "http://localhost:3000"}`
  );
});
