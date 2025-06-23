// models/SFURoom.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const SFURoomSchema = new Schema({
    // Tên phòng sau này hiển thị cho người dùng
    name: {
        type: String,
        required: [true, "Tên phòng là bắt buộc"],
    },
    // Chủ phòng: người tạo phòng (thường có quyền quản trị)
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Chủ phòng bắt buộc"],
    },
    // Danh sách các participant tham gia phòng SFU (danh sách userId)
    participants: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    // Các trạng thái liên quan đến việc chia sẻ luồng media cho phòng SFU:
    streaming: {
        camera: {
            type: Boolean,
            default: false,
        },
        screen: {
            type: Boolean,
            default: false,
        },
    },
    // Nếu cần thiết, có thể lưu thêm metadata của signaling, ví dụ: layout, quality, v.v.
    metadata: {
        type: Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("SFURoom", SFURoomSchema);
