// app.js
require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const ejsMate = require("ejs-mate");
const path = require('path');

const app = express();
connectDB();

// Cấu hình view engine (ví dụ dùng EJS)
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", "./views"); // Đảm bảo thư mục chứa file template

// app.js (trước khi định nghĩa routes)
app.use((req, res, next) => {
  // nếu req.user (từ middleware auth) tồn tại thì lấy, ngược lại để null
  res.locals.user = req.user || null;
  next();
});

app.use(helmet());
app.use(cors({ origin: process.env.APP_ORIGIN.split(",") }));
app.use(express.json());
// app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.urlencoded({ extended: false })); // để parse form-encoded
app.use(cookieParser());

// Routes
app.use("/api/v1/users", require("./routes/users"));
app.use("/api/v1/agencies", require("./routes/agencies"));
app.use("/api/v1/branches", require("./routes/branches"));
app.use("/api/v1/keys", require("./routes/keys"));
app.use("/admin", require("./routes/admin"));
app.use("/", require("./routes/adminAuth"));
app.use("/mail", require("./routes/emailRouter"));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/js', express.static(path.join(__dirname, 'public/js'))); // nếu cần
app.get('*', (req, res, next) => {
  res.locals.request = req;
  next();
});
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com;");
  next();
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, 
  () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`http://localhost:${PORT}/login`)
  }
);
