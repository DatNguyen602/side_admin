const mongoose = require("mongoose");

const EmojiSchema = new mongoose.Schema({
  shortcode: { type: String, required: true, unique: true },
  unicode: { type: String, required: true },
  category: { type: String },
  keywords: [String],
  aliases: [String],
  order: { type: Number },
  custom: { type: Boolean, default: false }
});

module.exports = mongoose.model("Emoji", EmojiSchema);
