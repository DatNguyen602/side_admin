// models/Messsage.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },

  contents: [
    {
      type: {
        type: String,
        enum: ["text", "image", "file", "video", "audio", "emoji", "sticker"],
        required: true
      },
      data: { type: String, required: true }, // text hoặc URL (image/video/file...)
      meta: { type: mongoose.Schema.Types.Mixed } // tuỳ loại có thể thêm caption, size, duration...
    }
  ],

  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  status: {
    type: String,
    enum: ["sending", "sent", "failed"],
    default: "sent"
  },

  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  createdAt: { type: Date, default: Date.now },
  editedAt: { type: Date },
  deletedAt: { type: Date }
});

module.exports = mongoose.model("Message", MessageSchema);
