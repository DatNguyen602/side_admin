const axios = require("axios");
const Emoji = require("../models/Emoji");
const mongoose = require("mongoose");
require("dotenv").config();

// Kết nối đến MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/mydb", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Lỗi kết nối MongoDB:", err);
    process.exit(1);
  }
};

/**
 * Hàm chuyển đổi chuỗi unified thành emoji thực sự
 */
function unifiedToEmoji(unified) {
  return unified
    .split("-")
    .map((code) => String.fromCodePoint(parseInt(code, 16)))
    .join("");
}

/**
 * Hàm kiểm tra xem một emoji có thể hiển thị được không
 */
const emojiRegex = require("emoji-regex");

function isRenderable(emoji) {
  const regex = emojiRegex();
  return regex.test(emoji);
}

async function seedAllEmojis() {
  try {
    const url =
      "https://raw.githubusercontent.com/iamcal/emoji-data/master/emoji.json";
    const response = await axios.get(url);
    const emojiData = response.data;

    // Xóa toàn bộ dữ liệu emoji cũ trước khi thêm mới
    await Emoji.deleteMany({});
    console.log("Đã xóa toàn bộ dữ liệu emoji cũ.");

    // Xử lý danh sách emoji, loại bỏ emoji không hiển thị
    const emojis = emojiData
      .map((item) => {
        const unicodeEmoji = unifiedToEmoji(item.unified);

        if (!isRenderable(unicodeEmoji)) {
          console.log(`Emoji ${unicodeEmoji} không hiển thị được, sẽ bị bỏ qua.`);
          return null;
        }

        return {
          shortcode: `:${item.short_name}:`,
          unicode: unicodeEmoji,
          category: item.category || "Uncategorized",
          keywords: item.keywords || [],
          order: item.sort_order || 0,
        };
      })
      .filter(Boolean); // Loại bỏ các giá trị null

    const inserted = await Emoji.insertMany(emojis);
    console.log(`Đã thêm thành công ${inserted.length} emoji vào cơ sở dữ liệu.`);
  } catch (error) {
    console.error("Có lỗi khi seed emoji:", error);
  } finally {
    mongoose.connection.close();
  }
}

connectDB();
seedAllEmojis();
