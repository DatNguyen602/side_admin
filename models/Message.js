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
      "icon",
      "reaction"
    ],
    required: true
  },
  data: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },

  contents: {
    type: [ContentSchema],
    validate: v => v.length > 0
  },

  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  status: {
    type: String,
    enum: ["sending", "sent", "failed"],
    default: "sent"
  },

  reactions: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      type: { type: String, required: true }, // e.g., "like", "heart", "laugh", "angry"
      icon: { type: String }, // có thể lưu emoji code hoặc đường dẫn icon
      addedAt: { type: Date, default: Date.now }
    }
  ],

  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true }],
  deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true }],

  createdAt: { type: Date, default: Date.now, index: true },
  editedAt: { type: Date },
  editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  deletedAt: { type: Date }
});

module.exports = mongoose.model("Message", MessageSchema);
