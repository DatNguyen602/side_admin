//routes/media.js
const express = require("express");
const router = express.Router();
const Emoji = require("../models/Emoji");
const StickerPack = require("../models/StickerPack");
const Gif = require("../models/Gif");

// GET /emoji
router.get("/emoji", async (req, res) => {
  const emojis = await Emoji.find().sort("order");
  res.json(emojis);
});

// GET /stickers
router.get("/stickers", async (req, res) => {
  const packs = await StickerPack.find({ isPublic: true });
  res.json(packs);
});

// GET /stickers/:packId
router.get("/stickers/:packId", async (req, res) => {
  const pack = await StickerPack.findById(req.params.packId);
  if (!pack) return res.status(404).json({ error: "Not found" });
  res.json(pack);
});

// GET /gif/search?q=funny
router.get("/gif/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing query" });

  // Optional: Replace with real Giphy/Tenor API
  const gifs = await Gif.find({ tags: { $in: [q] } }).limit(20);
  res.json(gifs);
});

module.exports = router;
