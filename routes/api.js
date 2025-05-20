const express = require("express");
const router = express.Router();
const Key = require("../models/Key");
const User = require("../models/User");
const Branch = require("../models/Branch");
const Agent = require("../models/Agent");
const path = require('path');

// Kiểm tra key
router.get("/check-key/:key", async (req, res) => {
  const key = await Key.findOne({ key: req.params.key });
  if (!key) return res.status(404).json({ valid: false, message: "Key không tồn tại." });
  res.json({ valid: !key.isUsed, key });
});

// Tạo key mới
router.post("/create-key", async (req, res) => {
  const { key, branchId } = req.body;
  const newKey = new Key({ key, branchId });
  await newKey.save();
  res.json({ message: "Key đã được tạo." });
});

// 1. Đăng ký folder public để serve file tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// 2. Cài đặt EJS làm view engine
app.set('views', path.join(__dirname, 'views'));  // đường dẫn đến templates
app.set('view engine', 'ejs');

module.exports = router;
