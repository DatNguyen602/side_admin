const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const IV_LENGTH = 16;
let AES_KEY;

if (process.env.AES_SECRET_KEY) {
  AES_KEY = Buffer.from(process.env.AES_SECRET_KEY, "hex");
  if (AES_KEY.length !== 32) {
    throw new Error("AES_SECRET_KEY must be 64 hex characters (32 bytes)");
  }
} else {
  AES_KEY = crypto.randomBytes(32);
  console.warn("⚠️ No AES_SECRET_KEY found. A random key was generated.");
}

const TEMP_DIR = path.join(__dirname, "..", "uploads/temp_uploads");
const ENC_DIR = path.join(__dirname, "..", "uploads/uploads_encrypted");

[ TEMP_DIR, ENC_DIR ].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const encryptFile = (inputPath, outputPath) => {
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
};

const decryptFile = (inputPath, outputStream) => {
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
    if (decipher) outputStream.end(decipher.final());
    else outputStream.end();
  });

  input.on("error", err => outputStream.destroy(err));
};

module.exports = {
  TEMP_DIR,
  ENC_DIR,
  encryptFile,
  decryptFile,
};
