const mongoose = require("mongoose");

const ContentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      "text",
      "image",
      "file",
      "video",
      "audio",
      "emoji",
      "sticker",
      "gif",
      "icon",     // NEW - icon đơn giản, kiểu biểu tượng hệ thống
      "reaction"  // NEW - biểu cảm người dùng gán vào message khác
    ],
    required: true
  },
  data: { type: String, required: true }, // có thể là text, URL hoặc mã emoji/icon
  meta: { type: mongoose.Schema.Types.Mixed } // caption, size, unicode, stickerPack, duration...
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },

  contents: [ContentSchema], // có thể chứa nhiều nội dung trong 1 message

  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  status: {
    type: String,
    enum: ["sending", "sent", "failed"],
    default: "sent"
  },

  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // NEW - Biểu cảm phản ứng từ người dùng (reaction riêng biệt với nội dung tin nhắn)
  reactions: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      type: { type: String, enum: ["like", "love", "laugh", "sad", "angry", "wow", "custom"] },
      icon: { type: String }, // mã emoji hoặc đường dẫn ảnh icon
      addedAt: { type: Date, default: Date.now }
    }
  ],

  createdAt: { type: Date, default: Date.now },
  editedAt: { type: Date },
  deletedAt: { type: Date }
});

module.exports = mongoose.model("Message", MessageSchema);
