const mongoose = require("mongoose");

const StickerPackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  coverImage: String,
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isPublic: { type: Boolean, default: true },
  tags: [String],
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("StickerPack", StickerPackSchema);
