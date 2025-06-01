//models/StickerPack.js
const mongoose = require("mongoose");

const StickerSchema = new mongoose.Schema({
  name: String,
  imageUrl: { type: String, required: true },
  keywords: [String],
  order: Number
}, { _id: false });

const StickerPackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  coverImage: String,
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  stickers: [StickerSchema],
  isPublic: { type: Boolean, default: true }
});

module.exports = mongoose.model("StickerPack", StickerPackSchema);
