// models/Room.js
const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
    name: { type: String },
    isGroup: { type: Boolean, default: false },
    // approvalStatus chỉ có ý nghĩa với room không nhóm (1‑1):
    approvalStatus: { type: String, enum: ['approved', 'pending'], default: 'approved' },
    joinPolicy: { type: String, enum: ['free', 'approval'], default: 'free' },
    members: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['creator', 'admin', 'member'], default: 'member' }
    }],
    joinRequests: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        requestedAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Room', RoomSchema);
