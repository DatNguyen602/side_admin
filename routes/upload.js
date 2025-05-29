const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const auth = require("../middleware/auth");
const { TEMP_DIR, ENC_DIR, encryptFile, decryptFile } = require("../middleware/fileEncryption");
const fsPromises = require("fs").promises;

const router = express.Router();
const upload = multer({ dest: TEMP_DIR });

router.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const encryptedPath = path.join(ENC_DIR, file.filename + ".enc");
  const metaPath = path.join(ENC_DIR, file.filename + ".meta");

  let type = "file";
  if (file.mimetype.startsWith("image/")) {
    if (file.originalname.toLowerCase().includes("sticker")) {
      type = "sticker";
    } else if (file.size < 100 * 1024) {
      type = "emoji";
    } else {
      type = "image";
    }
  } else if (file.mimetype.startsWith("video/")) {
    type = "video";
  } else if (file.mimetype.startsWith("audio/")) {
    type = "audio";
  } else if (file.mimetype === "text/plain") {
    type = "text";
  }

  try {
    await encryptFile(file.path, encryptedPath);
    try {
      await fsPromises.unlink(file.path); // xóa file gốc
    } catch (unlinkErr) {
      console.error("Failed to delete original file:", unlinkErr);
      // Không cần return lỗi, có thể tiếp tục
    }

    const meta = {
      fileId: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      type,
    };

    try {
      await fsPromises.writeFile(metaPath, JSON.stringify(meta));
    } catch (writeErr) {
      console.error("Failed to write metadata file:", writeErr);
      // Có thể trả lỗi, hoặc bỏ qua tùy ý
      return res.status(500).json({ error: "Failed to save metadata" });
    }

    res.json({ fileId: file.filename, type });
  } catch (err) {
    console.error("Upload failed:", err);
    // Nếu có file tạm tồn tại, xóa luôn để tránh rác
    try {
      await fsPromises.unlink(file.path);
    } catch {}
    res.status(500).json({ error: "Encryption failed" });
  }
});

router.get("/download/:fileId", auth, (req, res) => {
  const fileId = req.params.fileId;
  const encryptedPath = path.join(ENC_DIR, fileId + ".enc");
  const metaPath = path.join(ENC_DIR, fileId + ".meta");

  if (!fs.existsSync(encryptedPath) || !fs.existsSync(metaPath)) {
    return res.status(404).send("File not found");
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  res.setHeader("Content-Type", meta.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${meta.originalName}"`);

  decryptFile(encryptedPath, res);
});

router.get("/view/:fileId", auth, (req, res) => {
  const fileId = req.params.fileId;
  const encryptedPath = path.join(ENC_DIR, fileId + ".enc");
  const metaPath = path.join(ENC_DIR, fileId + ".meta");

  if (!fs.existsSync(encryptedPath) || !fs.existsSync(metaPath)) {
    return res.status(404).send("File not found");
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const allowView = [ "image/", "video/", "audio/" ];

  if (!allowView.some(prefix => meta.mimeType.startsWith(prefix))) {
    return res.status(415).send("Unsupported file type for viewing");
  }

  res.setHeader("Content-Type", meta.mimeType);
  decryptFile(encryptedPath, res);
});

module.exports = router;
