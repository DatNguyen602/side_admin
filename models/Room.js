const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
    name: { type: String }, // Có thể để trống nếu là 1-1
    isGroup: { type: Boolean, default: false },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Room', RoomSchema);
