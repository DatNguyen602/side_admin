// models/Gif.js
const mongoose = require('mongoose');

const GifSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true }, // Giphy ID
  type: { type: String, default: 'gif' },
  title: String,
  slug: String,
  url: String,
  path: String,
  embed_url: String,
  rating: String,
  is_sticker: Boolean,
  imported_at: Date,

  images: {
    original: String,
    preview: String,
    fixed_height_small: String,
    original_mp4: String
  },

  user: {
    username: String,
    display_name: String,
    profile_url: String,
    avatar_url: String,
    is_verified: Boolean
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Gif', GifSchema);
