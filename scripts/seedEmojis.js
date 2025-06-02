// seedEmojis.js
const axios = require("axios");
const Emoji = require("../models/Emoji");
const mongoose = require('mongoose');
require("dotenv").config(); // Import dotenv

// Kết nối đến MongoDB – thay đổi chuỗi kết nối cho phù hợp
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/mydb', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

/**
 * Hàm chuyển đổi chuỗi unified (ví dụ: "1F600" hoặc "1F3F3-FE0F-200D-1F308")
 * thành emoji thực sự
 */
function unifiedToEmoji(unified) {
  return unified
    .split("-")
    .map((code) => String.fromCodePoint(parseInt(code, 16)))
    .join("");
}

async function seedAllEmojis() {
  try {
    // URL dữ liệu emoji đầy đủ từ repository iamcal/emoji-data
    const url =
      "https://raw.githubusercontent.com/iamcal/emoji-data/master/emoji.json";
    const response = await axios.get(url);
    const emojiData = response.data;

    // Chuyển đổi dữ liệu sao cho phù hợp với schema của bạn
    // Ở đây, chúng ta sử dụng:
    // - shortcode: dùng trường short_name và bao trong dấu ":"
    // - unicode: tính từ trường unified
    // - category, keywords và order: lấy từ dữ liệu, có thể gán giá trị mặc định nếu thiếu
    const emojis = emojiData.map((item, index) => {
        console.log(`item ${index}: ${item.unified}`);
        return {
        shortcode: `:${item.short_name}:`,
        unicode: unifiedToEmoji(item.unified),
        category: item.category || "Uncategorized",
        keywords: item.keywords || [],
        order: item.sort_order || 0,
        }
    });

    // Xóa toàn bộ dữ liệu emoji cũ (nếu có)
    await Emoji.deleteMany({});
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
