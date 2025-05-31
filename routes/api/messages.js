// routes/api/messages.js
const router = require("express").Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const Room = require("../../models/Room");
const Message = require("../../models/Message");
const path = require("path");
const { promises: fsPromises } = require("fs");
const mongoose = require("mongoose");

const ENC_DIR = path.join(__dirname, "../..", "uploads/uploads_encrypted");

router.post("/new", auth, async (req, res) => {
    try{
        const userId = req.user._id;
        const mesNew = await Message.findOne({ room: req.body.roomId, readBy: { $nin: [userId] } })
        .sort({ createdAt: -1 });
        res.status(200).json(mesNew?.toObject());
        }
    catch(err) {
        console.log(err);
        res.status(200);
    }
});

/**
 * POST /start
 * Khởi tạo cuộc trò chuyện (nếu chưa tồn tại) và gửi tin nhắn đầu tiên.
 * Nếu chưa là bạn bè: tạo một room với approvalStatus 'pending'
 */
router.post("/start", auth, async (req, res) => {
    const senderId = req.user._id;
    const { targetUserId } = req.body;

    // Kiểm tra targetUserId hợp lệ
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ error: "Invalid target user id." });
    }

    try {
        // Tìm phòng chat 1-1 giữa sender và target, bất kể trạng thái
        let room = await Room.findOne({
            isGroup: false,
            members: {
                $all: [
                    { $elemMatch: { user: senderId } },
                    { $elemMatch: { user: targetUserId } }
                ],
                $size: 2
            }
        });

        // Nếu chưa có phòng, tạo mới với approvalStatus 'pending'
        if (!room) {
            room = new Room({
                isGroup: false,
                // Thuộc tính approvalStatus chỉ có tác dụng cho room 1-1
                approvalStatus: 'pending',
                members: [
                    { user: senderId, role: "member" },
                    { user: targetUserId, role: "member" }
                ]
            });
            await room.save();
        }

        res.status(200).json({
            message: "Message sent. Awaiting approval if not friends.",
            room
        });
    } catch (err) {
        console.error("Error starting conversation:", err);
        res.status(500).json({ error: "Server error." });
    }
});

/**
 * POST /approve
 * Endpoint cho phép người nhận duyệt cuộc trò chuyện pending.
 * Khi duyệt, cập nhật room.approvalStatus thành 'approved'
 */
router.post("/approve", auth, async (req, res) => {
    const userId = req.user._id;
    const { roomId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: "Invalid room ID." });
    }
    
    try {
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ error: "Room not found." });
        }
        // Kiểm tra quyền truy cập: user phải là thành viên trong room
        if (!room.members.some(m => m.user.toString() === userId)) {
            return res.status(403).json({ error: "Not authorized." });
        }
        if (room.approvalStatus === "approved") {
            return res.status(400).json({ error: "Room is already approved." });
        }

        room.approvalStatus = "approved";
        await room.save();

        res.json({ message: "Conversation approved. You can now chat.", room });
    } catch (err) {
        console.error("Error approving conversation:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * GET /:roomId
 * Lấy danh sách tin nhắn theo phòng.
 * Bao gồm phân trang, cập nhật trạng thái đã đọc, và xử lý metadata file attachments.
 */
router.get("/:roomId", auth, async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user._id;
    
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: "Room ID không hợp lệ!" });
    }
    
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;

    try {
        // Kiểm tra quyền truy cập: user phải là thành viên của room
        const room = await Room.findOne({
            _id: roomId,
            "members.user": userId,
        });
        if (!room) return res.status(404).json({ error: "Room not found!" });

        // Truy vấn tin nhắn theo phân trang (mới nhất trước, sau đó sắp xếp lại theo ascending)
        let messages = await Message.find({
            room: roomId,
            deletedBy: { $ne: userId }
        })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .populate("sender", "username avatar")
            .lean();

        // Cập nhật danh sách đã đọc cho các tin nhắn
        const messageIds = messages.map((msg) => msg._id);
        await Message.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { readBy: userId } }
        );

        // Xử lý metadata cho file attachments bất đồng bộ
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
                            console.log(err)
                            return i;
                        }
                    }
                    return i;
                }));
            }
            return {
                ...msg,
                sendBy: (msg.sender && msg.sender._id.toString() === userId.toString()) ? "you" : "other",
            };
        }));

        // Sắp xếp tin nhắn theo thứ tự thời gian (tăng dần)
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

        // Đặt tên cho phòng nếu là cuộc trò chuyện đơn (1-1)
        if (!roomObj.isGroup && roomObj.members.length === 2) {
            const mb = members.find(
                (m) => m._id.toString() !== userId.toString()
            );
            roomObj.name = mb.username;
            roomObj.icon = mb.avatar;
        }

        res.json({ messages, room: roomObj, offset, limit });
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
