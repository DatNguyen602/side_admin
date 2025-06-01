//models/Emoji.js
const mongoose = require("mongoose");

const EmojiSchema = new mongoose.Schema({
  shortcode: { type: String, required: true },   // ":smile:"
  unicode: { type: String, required: true },     // "😄"
  category: { type: String },
  keywords: [String],
  order: { type: Number }
});

module.exports = mongoose.model("Emoji", EmojiSchema);
