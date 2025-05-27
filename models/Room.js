// models/Room.js
const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
    name: { type: String },
    isGroup: { type: Boolean, default: false },
    members: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['creator', 'admin', 'member'], default: 'member' }
    }],
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Room', RoomSchema);
