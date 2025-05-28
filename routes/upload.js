const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const auth = require("../middleware/auth");
require("dotenv").config();

const router = express.Router();

// ==== CẤU HÌNH AES ====
let AES_KEY;
if (process.env.AES_SECRET_KEY) {
  AES_KEY = Buffer.from(process.env.AES_SECRET_KEY, "hex");
  if (AES_KEY.length !== 32) {
    throw new Error("AES_SECRET_KEY must be 64 hex characters (32 bytes)");
  }
} else {
  AES_KEY = crypto.randomBytes(32);
  console.warn("⚠️ No AES_SECRET_KEY found. A random key was generated for this session.");
}
const IV_LENGTH = 16;

// ==== THƯ MỤC LƯU FILE ====
const TEMP_DIR = path.join(__dirname, "..", "uploads/temp_uploads");
const ENC_DIR = path.join(__dirname, "..", "uploads/uploads_encrypted");

[ TEMP_DIR, ENC_DIR ].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// ==== CẤU HÌNH MULTER ====
const upload = multer({ dest: TEMP_DIR });

// ==== HÀM MÃ HÓA FILE ====
function encryptFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", AES_KEY, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    output.write(iv);
    input.pipe(cipher).pipe(output);

    output.on("finish", resolve);
    output.on("error", reject);
    input.on("error", reject);
  });
}

// ==== HÀM GIẢI MÃ FILE ====
function decryptFile(inputPath, outputStream) {
  const input = fs.createReadStream(inputPath, { highWaterMark: 1024 });

  let iv = Buffer.alloc(0);
  let decipher;

  input.on("data", chunk => {
    if (!decipher) {
      iv = Buffer.concat([iv, chunk]);
      if (iv.length >= IV_LENGTH) {
        const ivReal = iv.slice(0, IV_LENGTH);
        const rest = iv.slice(IV_LENGTH);
        decipher = crypto.createDecipheriv("aes-256-cbc", AES_KEY, ivReal);
        outputStream.write(decipher.update(rest));
      }
    } else {
      outputStream.write(decipher.update(chunk));
    }
  });

  input.on("end", () => {
    if (decipher) {
      outputStream.end(decipher.final());
    } else {
      outputStream.end();
    }
  });

  input.on("error", err => outputStream.destroy(err));
}

// ==== API: UPLOAD FILE ====
router.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const encryptedPath = path.join(ENC_DIR, file.filename + ".enc");
  const metaPath = path.join(ENC_DIR, file.filename + ".meta.json");

  // Phân loại file
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
      type: type,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta));

    res.json({ fileId: file.filename, type: meta.type });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Encryption failed" });
  }
});

// ==== API: DOWNLOAD FILE ====
router.get("/download/:fileId", auth, (req, res) => {
  try {
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
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ==== API: XEM FILE TRONG TRÌNH DUYỆT ====
router.get("/view/:fileId", auth, (req, res) => {
  try {
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
  } catch (err) {
    console.error("View error:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
