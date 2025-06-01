//models/Gif.js
const mongoose = require("mongoose");

const GifSchema = new mongoose.Schema({
  title: String,
  url: { type: String, required: true },
  path: { type: String, required: true },
  previewUrl: String,
  tags: [String],
  source: { type: String, enum: ["giphy", "tenor", "local"] },
  createdAt: { type: Date, default: Date.now },
  addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Gif", GifSchema);
