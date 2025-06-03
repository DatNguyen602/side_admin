// routes/api/gif.js
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const auth = require("../../middleware/auth");
const Gif = require("../../models/Gif"); // model Gif của bạn
const router = express.Router();

// 2. Route tìm kiếm GIF trên Giphy
// 2. Route tìm kiếm GIF trên Giphy (đã bổ sung kiểm tra xem đã lưu chưa)
router.get("/search", auth, async (req, res) => {
  const q = req.query.q;
  let gifs = [];
  const limit = 30;
  const offset = 0; // luôn bắt đầu từ 0 khi load lần đầu

   {
    try {
      const response = await axios.get(
        `https://api.giphy.com/v1/gifs${(q) ? '/search' : '/trending'}`,
        {
          params: {
            api_key: process.env.API_GIPHY, // Hoặc GIPHY_API_KEY
            q,
            limit,
            offset,
          },
        }
      );
      const rawGifs = response.data.data;

      // Sử dụng Promise.all để chạy song song việc check DB
      gifs = await Promise.all(
        rawGifs.map(async (gif) => {
          // Chọn URL hiển thị (ví dụ fixed_width_small)
          const originalUrl = gif.images?.fixed_width_small?.url || gif.url;
          const proxyUrl = `/admin/proxy?url=${encodeURIComponent(originalUrl)}`;

          // Kiểm tra trong DB xem đã có GIF với id này chưa
          const existing = await Gif.findOne({ id: gif.id }).select("_id").lean();
          const isSaved = !!existing; // true nếu tìm thấy

          return {
            ...gif,
            proxyUrl,
            isSaved,
          };
        })
      );
    } catch (err) {
      console.error("Error fetching from Giphy:", err.message);
    }
  }

  // Tính hasMore dựa vào số GIF vừa lấy được
  const hasMore = gifs.length === limit;

  // Render view và truyền mảng gifs (mỗi phần tử có thêm isSaved)
  res.render("admin/gifSearch", {
    title: "gif/gifSearch",
    user: req.user,
    gifs,
    query: q,
    offset: limit,   // lần đầu offset sẽ là 10
    hasMore,
  });
});

// (2) Route mới: /admin/gif/search/json — trả JSON để infinite scroll
router.get("/search/json", auth, async (req, res) => {
  const q = req.query.q || "";
  const limit = 30;
  const offset = parseInt(req.query.offset, 10) || 0;
  let gifs = [];

  // if (!q) {
  //   return res.json({ gifs: [], nextOffset: offset, hasMore: false });
  // }

  try {
    const response = await axios.get(
      `https://api.giphy.com/v1/gifs${(q) ? '/search' : '/trending'}`,
      {
        params: {
          api_key: process.env.API_GIPHY,
          q,
          limit,
          offset,
        },
      }
    );
    const rawGifs = response.data.data;

    gifs = await Promise.all(
      rawGifs.map(async (gif) => {
        const originalUrl = gif.images?.fixed_width_small?.url || gif.url;
        const proxyUrl = `/admin/proxy?url=${encodeURIComponent(
          originalUrl
        )}`;

        const existing = await Gif.findOne({ id: gif.id }).select("_id").lean();
        const isSaved = !!existing;

        return {
            ...gif,
            proxyUrl,
            isSaved,
        };
      })
    );

    // Tính nextOffset và hasMore
    const nextOffset = offset + limit;
    const hasMore = rawGifs.length === limit; // nếu rawGifs < limit => về hết dữ liệu

    return res.json({ gifs, nextOffset, hasMore });
  } catch (err) {
    console.error("Error fetching search JSON GIF:", err.message);
    return res.status(500).json({ error: "Không thể lấy GIF" });
  }
});

// 3. Route lưu GIF vào server và lưu metadata vào DB
router.post("/save", auth, async (req, res) => {
  try {
    // Parse lại GIF JSON nếu cần
    const gif =
      typeof req.body.gifJson === "string"
        ? JSON.parse(req.body.gifJson)
        : req.body.gifJson;

    // Lấy lại từ khóa search để redirect về
    const originalQuery = req.body.q || "";

    // Kiểm tra nếu đã tồn tại
    const existing = await Gif.findOne({ id: gif.id });
    if (existing) {
      // Nếu đã lưu rồi thì chỉ redirect về trang search (có thể kèm thông báo flash nếu bạn muốn)
      return res.redirect(`/admin/gif/search?q=${encodeURIComponent(originalQuery)}`);
    }

    const fileName = `${gif.id}.gif`;
    const savePath = path.join(__dirname, "../../public/uploads/gifs", fileName);

    // Tạo folder nếu chưa có
    fs.mkdirSync(path.dirname(savePath), { recursive: true });

    // Tải file GIF gốc về server
    const writer = fs.createWriteStream(savePath);
    const response = await axios({
      url: gif.images?.original?.url || gif.url,
      method: "GET",
      responseType: "stream",
    });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // Tạo dữ liệu để lưu vào DB
    const gifData = {
      id: gif.id,
      type: gif.type,
      title: gif.title,
      slug: gif.slug,
      url: gif.url,
      embed_url: gif.embed_url,
      rating: gif.rating,
      is_sticker: gif.is_sticker === 1,
      imported_at: gif.import_datetime ? new Date(gif.import_datetime) : null,
      path: (process.env.DOMAIN || "") + `/uploads/gifs/${fileName}`,
      uploadedBy: req.user?._id,
      images: {
        original: gif.images?.original?.url,
        preview: gif.images?.preview_gif?.url || gif.images?.preview?.url,
        fixed_height_small: gif.images?.fixed_height_small?.url,
        original_mp4: gif.images?.original_mp4?.mp4,
      },
      user: gif.user
        ? {
            username: gif.user.username,
            display_name: gif.user.display_name,
            profile_url: gif.user.profile_url,
            avatar_url: gif.user.avatar_url,
            is_verified: gif.user.is_verified,
          }
        : undefined,
    };

    await Gif.create(gifData);

    // Sau khi lưu xong, redirect về trang /admin/gif/search?q=<originalQuery>
    return res.redirect(`/admin/gif/search?q=${encodeURIComponent(originalQuery)}`);
  } catch (err) {
    console.error("Error saving GIF:", err);
    return res.status(500).send("Lỗi khi lưu GIF.");
  }
});

// Xem thư viện gif
router.get("/library", auth, async (req, res) => {
  const gifs = await Gif.find();
  res.render("admin/gifLibrary", { 
    title: "gif/library",
    user: req.user,
    gifs });
});

module.exports = router;
