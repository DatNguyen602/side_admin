const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { pipeline, Transform } = require("stream");
const { promisify } = require("util");

require("dotenv").config();

const pipe = promisify(pipeline);
const IV_LENGTH = 16;

// Load AES key
let AES_KEY;
if (process.env.AES_SECRET_KEY) {
  AES_KEY = Buffer.from(process.env.AES_SECRET_KEY, "hex");
  if (AES_KEY.length !== 32) throw new Error("AES_SECRET_KEY must be 64 hex characters (32 bytes)");
} else {
  AES_KEY = crypto.randomBytes(32);
  console.warn("⚠️ AES_SECRET_KEY not set. Using random key.");
}

// Folders
const TEMP_DIR = path.join(__dirname, "..", "uploads", "temp_uploads");
const ENC_DIR = path.join(__dirname, "..", "uploads", "uploads_encrypted");
[ TEMP_DIR, ENC_DIR ].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// Encrypt a file (gzip + AES256)
async function encryptFile(inputPath, outputPath) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", AES_KEY, iv);

  const prependIV = new Transform({
    transform(chunk, encoding, callback) {
      if (!this.ivPrepended) {
        this.push(iv);
        this.ivPrepended = true;
      }
      this.push(chunk);
      callback();
    }
  });

  await pipe(
    fs.createReadStream(inputPath),
    zlib.createGzip(),
    cipher,
    prependIV,
    fs.createWriteStream(outputPath)
  );
}

// Decrypt (AES256) + gunzip into outputStream
async function decryptFile(inputPath, outputStream) {
  const input = fs.createReadStream(inputPath);
  let decipher, gunzip;

  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      if (!this.iv) {
        this.buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
        if (this.buffer.length >= IV_LENGTH) {
          this.iv = this.buffer.slice(0, IV_LENGTH);
          const rest = this.buffer.slice(IV_LENGTH);
          decipher = crypto.createDecipheriv("aes-256-cbc", AES_KEY, this.iv);
          gunzip = zlib.createGunzip();
          this.pipe(decipher).pipe(gunzip).pipe(outputStream);
          if (rest.length > 0) this.push(rest);
        }
        callback();
      } else {
        this.push(chunk);
        callback();
      }
    }
  });

  try {
    await pipe(input, transformStream);
  } catch (err) {
    console.error("Decryption failed:", err);
    outputStream.destroy(err);
  }
}

module.exports = {
  TEMP_DIR,
  ENC_DIR,
  encryptFile,
  decryptFile
};
