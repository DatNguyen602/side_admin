const express = require("express");
const router = express.Router();
const Emoji = require("../models/Emoji");
const StickerPack = require("../models/StickerPack");
const Gif = require("../models/Gif");
const auth = require("../middleware/auth");

// GET /emoji với phân trang
router.get("/emoji", auth, async (req, res) => {
  const { limit = 50, offset = 0 } = req.query; // Nhận tham số từ request
  const emojis = await Emoji.find().skip(parseInt(offset)).limit(parseInt(limit)).sort("order");
  res.json(emojis);
});

// GET /stickers với phân trang
router.get("/stickers", auth, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const packs = await StickerPack.find({ isPublic: true })
    .skip(parseInt(offset))
    .limit(parseInt(limit));
  res.json(packs);
});

// GET /gif với phân trang
router.get("/gif", auth, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const pack = await Gif.find()
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .sort("order");
  res.json(pack);
});

module.exports = router;
