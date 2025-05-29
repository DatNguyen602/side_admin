// routes/users.js
const router = require("express").Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const Room = require("../../models/Room");
const Message = require("../../models/Message");
const path = require("path");
const { promises: fsPromises } = require("fs");
const mongoose = require("mongoose");

const ENC_DIR = path.join(__dirname, "..", "uploads/uploads_encrypted");

router.get("/:roomId", auth, async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    
    // Kiểm tra xem roomId có hợp lệ là ObjectId không
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: "Room ID không hợp lệ!" });
    }
    
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;

    try {
        // Kiểm tra quyền truy cập của người dùng trong phòng
        const room = await Room.findOne({
            _id: roomId,
            "members.user": userId,
        });
        if (!room) return res.status(404).json({ error: "Room not found!" });

        // Truy vấn tin nhắn theo phân trang
        let messages = await Message.find({
            room: roomId,
            deletedBy: { $ne: userId }
        })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .populate("sender", "username avatar")
            .lean();

        // Cập nhật trạng thái đọc cho các tin nhắn
        const messageIds = messages.map((msg) => msg._id);
        await Message.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { readBy: userId } }
        );

        // Xử lý metadata cho file attachments (bất đồng bộ)
        messages = await Promise.all(messages.map(async (msg) => {
            if (msg.contents && Array.isArray(msg.contents)) {
                msg.contents = await Promise.all(msg.contents.map(async (i) => {
                    if (i.type !== "text") {
                        const metaPath = path.join(ENC_DIR, i.data + ".meta");
                        try {
                            await fsPromises.access(metaPath);
                            const data = await fsPromises.readFile(metaPath, "utf8");
                            const meta = JSON.parse(data);
                            return { ...i, originalName: meta.originalName };
                        } catch (err) {
                            return i;
                        }
                    }
                    return i;
                }));
            }
            return {
                ...msg,
                sendBy: msg.sender && msg.sender._id.toString() === userId.toString() ? "you" : "other",
            };
        }));

        // Sắp xếp lại tin nhắn theo thời gian gửi (tăng dần)
        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Lấy thông tin thành viên của room
        const members = await Promise.all(
            room.members.map(async (m) => {
                const u = await User.findById(m.user).select("_id username avatar email");
                return u;
            })
        );
        const roomObj = room.toObject();
        roomObj.members = members;

        // Đặt tên cho phòng nếu là cuộc trò chuyện cá nhân
        if (!roomObj.isGroup && roomObj.members.length === 2) {
            roomObj.name = members.find(
                (m) => m._id.toString() !== userId.toString()
            ).username;
        }

        res.json({ messages, room: roomObj, offset, limit });
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
