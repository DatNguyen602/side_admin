const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Setup folder uploads (thư mục gốc chứa tất cả các file upload)
const uploadBasePath = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadBasePath)) {
  fs.mkdirSync(uploadBasePath);
}

// Multer config với phân loại file theo thư mục
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "files"; // mặc định

    if (file.mimetype.startsWith("image/")) {
      // Nếu tên file có chứa "sticker" thì phân loại là sticker
      if (file.originalname.toLowerCase().includes("sticker")) {
        folder = "stickers";
      }
      // Nếu kích thước file nhỏ (ví dụ dưới 100KB), coi như emoji
      else if (file.size && file.size < 100 * 1024) {
        folder = "emoji";
      } else {
        folder = "images";
      }
    } else if (file.mimetype.startsWith("video/")) {
      folder = "videos";
    } else if (file.mimetype.startsWith("audio/")) {
      folder = "audios";
    } else if (file.mimetype === "text/plain") {
      folder = "texts";
    }
    // Tạo đường dẫn thư mục con
    const folderPath = path.join(uploadBasePath, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Endpoint upload multiple files
router.post("/", upload.array("files", 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  // Mỗi file được lưu vào một thư mục con khác nhau nên cần lấy tên folder từ file.destination
  const filesInfo = req.files.map(file => {
    const folderName = path.basename(file.destination);
    return {
      url: `/uploads/${folderName}/${file.filename}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype
    };
  });

  res.json({ files: filesInfo });
});

module.exports = router;
