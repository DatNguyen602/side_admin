// models/Room.js
const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  isGroup: { type: Boolean, default: false },
  // joinPolicy: "free" cho phép gia nhập tự do; "approval" yêu cầu phê duyệt.
  joinPolicy: { type: String, enum: ['free', 'approval'], default: 'free' },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: { type: String, enum: ["creator", "admin", "member"], default: "member" },
    },
  ],
  // Danh sách các join request chưa được xử lý
  joinRequests: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      requestedAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Room", RoomSchema);
