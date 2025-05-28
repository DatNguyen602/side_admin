const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const auth = require("../middleware/auth");
const { TEMP_DIR, ENC_DIR, encryptFile, decryptFile } = require("../middleware/fileEncryption");

const router = express.Router();
const upload = multer({ dest: TEMP_DIR });

router.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const encryptedPath = path.join(ENC_DIR, file.filename + ".enc");
  const metaPath = path.join(ENC_DIR, file.filename + ".meta.json");

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
    fs.unlinkSync(file.path);

    const meta = {
      fileId: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      type,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta));

    res.json({ fileId: file.filename, type });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Encryption failed" });
  }
});

router.get("/download/:fileId", auth, (req, res) => {
  const fileId = req.params.fileId;
  const encPath = path.join(ENC_DIR, fileId + ".enc");
  const metaPath = path.join(ENC_DIR, fileId + ".meta.json");

  if (!fs.existsSync(encPath) || !fs.existsSync(metaPath)) {
    return res.status(404).send("File not found");
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  res.setHeader("Content-Type", meta.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${meta.originalName}"`);

  decryptFile(encPath, res);
});

router.get("/view/:fileId", auth, (req, res) => {
  const fileId = req.params.fileId;
  const encPath = path.join(ENC_DIR, fileId + ".enc");
  const metaPath = path.join(ENC_DIR, fileId + ".meta.json");

  if (!fs.existsSync(encPath) || !fs.existsSync(metaPath)) {
    return res.status(404).send("File not found");
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const allowView = [ "image/", "video/", "audio/" ];

  if (!allowView.some(prefix => meta.mimeType.startsWith(prefix))) {
    return res.status(415).send("Unsupported file type for viewing");
  }

  res.setHeader("Content-Type", meta.mimeType);
  decryptFile(encPath, res);
});

module.exports = router;
