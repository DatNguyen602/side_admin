const router = require("express").Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const Room = require("../../models/Room");
const Message = require("../../models/Message");
const path = require("path");
const { promises: fsPromises } = require("fs");
const mongoose = require("mongoose");

const ENC_DIR = path.join(__dirname, "../..", "uploads/uploads_encrypted");

router.get("/mono/:id", auth, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: "Không tìm thấy tin nhắn!" });
        }
        res.json(message);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server", error });
    }
});

/**
 * POST /new
 * Lấy tin nhắn chưa đọc gần nhất trong phòng theo user.
 */
router.post("/new", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { roomId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ error: "Invalid room ID." });
    }

    const mesNew = await Message.findOne({
      room: roomId,
      readBy: { $nin: [userId] },
      deletedBy: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!mesNew) return res.status(204).json({ message: "No new messages" });

    res.status(200).json(mesNew);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /start
 * Tạo phòng chat 1-1 nếu chưa có, với trạng thái approval 'pending'.
 * Nếu có message đầu tiên, tạo luôn message đó.
 */
router.post("/start", auth, async (req, res) => {
  const senderId = req.user._id;
  const { targetUserId, messageContents } = req.body;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ error: "Invalid target user id." });
  }

  try {
    // Tìm phòng chat 1-1 giữa sender và target
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

    if (!room) {
      room = new Room({
        isGroup: false,
        approvalStatus: "pending",
        members: [
          { user: senderId, role: "member" },
          { user: targetUserId, role: "member" }
        ]
      });
      await room.save();
    }

    let message = null;
    if (Array.isArray(messageContents) && messageContents.length > 0) {
      message = new Message({
        sender: senderId,
        room: room._id,
        contents: messageContents,
        status: room.approvalStatus === "approved" ? "sent" : "sending"
      });
      await message.save();
    }

    res.status(200).json({
      message: "Conversation started.",
      room,
      message
    });
  } catch (err) {
    console.error("Error starting conversation:", err);
    res.status(500).json({ error: "Server error." });
  }
});

/**
 * POST /approve
 * Người nhận duyệt cuộc trò chuyện pending.
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
 * Lấy danh sách tin nhắn theo phòng, phân trang, cập nhật trạng thái đã đọc,
 * xử lý metadata file attachments và phản hồi thông tin room kèm thành viên.
 */
router.get("/:roomId", auth, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(400).json({ error: "Room ID không hợp lệ!" });
  }

  // Lấy limit/offset từ query (mặc định limit = 30, tối đa 100)
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    // Kiểm tra user có thuộc phòng không
    const room = await Room.findOne({
      _id: roomId,
      "members.user": userId,
    });
    if (!room) {
      return res.status(404).json({ error: "Room not found!" });
    }

    // Tính tổng số tin nhắn (chưa bị user xóa) trong room
    const totalMessages = await Message.countDocuments({
      room: roomId,
      deletedBy: { $ne: userId },
    });

    // Lấy messages theo phòng, skip/limit, sort giảm dần (newest first)
    let messages = await Message.find({
      room: roomId,
      deletedBy: { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("sender", "username avatar")
      .lean();

    console.log("userId: " + userId);
    // Cập nhật readBy cho user hiện tại
    const messageIds = messages.map((msg) => msg._id);
    for (const messageId of messageIds) {
        try {
            const result = await Message.updateOne(
                { _id: messageId, "readBy.userId": { $ne: userId } },
                { $addToSet: { readBy: { userId, timestamp: new Date() } } }
            );
            console.log(`Cập nhật thành công messageId: ${messageId}`, result);
        } catch (err) {
            console.error(
                `Lỗi tại messageId ${messageId}:`,
                JSON.stringify(err, null, 2)
            );
        }
    }  

    // Xử lý metadata file và group reactions
    messages = await Promise.all(
      messages.map(async (msg) => {
        // Group reactions theo type
        if (!msg.reactions) msg.reactions = [];
        const groupedReactions = {};
        for (const r of msg.reactions) {
          if (!groupedReactions[r.type]) groupedReactions[r.type] = [];
          groupedReactions[r.type].push({
            user: r.user,
            icon: r.icon,
            addedAt: r.addedAt,
          });
        }
        msg.groupedReactions = groupedReactions;

        // Đọc metadata file (nếu type != text)
        if (msg.contents && Array.isArray(msg.contents)) {
          msg.contents = await Promise.all(
            msg.contents.map(async (i) => {
              if (i.type !== "text") {
                const metaPath = path.join(ENC_DIR, i.data + ".meta");
                try {
                  await fsPromises.access(metaPath);
                  const data = await fsPromises.readFile(metaPath, "utf8");
                  const meta = JSON.parse(data);
                  return { ...i, originalName: meta.originalName };
                } catch {
                  return i;
                }
              }
              return i;
            })
          );
        }

        // Đánh dấu sender là "you" hay "other"
        msg.sendBy =
          msg.sender && msg.sender._id.toString() === userId.toString()
            ? "you"
            : "other";
        return msg;
      })
    );

    // Đổi thứ tự messages thành tăng dần (oldest first)
    // => Điều này sẽ giúp client dễ append lên đầu khi load thêm cũ
    messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Lấy thông tin members của room
    const members = await Promise.all(
      room.members.map(async (m) => {
        return await User.findById(m.user).select("_id username avatar email");
      })
    );
    const roomObj = room.toObject();
    roomObj.members = members;
    if (!roomObj.isGroup && roomObj.members.length === 2) {
      const otherMember = members.find(
        (m) => m._id.toString() !== userId.toString()
      );
      roomObj.name = otherMember.username;
      roomObj.icon = otherMember.avatar;
    }

    // Tính hasMore: nếu offset + số bản ghi đã trả về < tổng, tức vẫn còn.
    const hasMore = offset + messages.length < totalMessages;

    return res.json({
      messages,
      room: roomObj,
      offset,
      limit,
      totalMessages,
      hasMore,
    });
  } catch (err) {
    console.error("Error fetching messages:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/message/react
router.post("/react", auth, async (req, res) => {
  const userId = req.user._id;
  const { messageId, reactionType } = req.body;

  if (!mongoose.Types.ObjectId.isValid(messageId) || !reactionType) {
    return res.status(400).json({ error: "Invalid data." });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found." });

    // Kiểm tra xem đã reaction chưa
    const existingIndex = message.reactions.findIndex(
      r => r.user.toString() === userId && r.type === reactionType
    );

    if (existingIndex >= 0) {
      // Nếu đã tồn tại => xoá
      message.reactions.splice(existingIndex, 1);
    } else {
      // Thêm mới
      message.reactions.push({
        user: userId,
        type: reactionType,
        icon: reactionType // icon có thể là emoji code
      });
    }

    await message.save();

    res.status(200).json({ message: "Reaction updated", reactions: message.reactions });
  } catch (err) {
    console.error("Reaction error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Xóa 1 reaction theo reactionType (DELETE /react)
// Yêu cầu: trong req.body cần có messageId và reactionType
router.delete("/react", auth, async (req, res) => {
  const userId = req.user._id;
  const { messageId, reactionType } = req.body;
  console.log(messageId);
  console.log(req.body);

  if (!mongoose.Types.ObjectId.isValid(messageId) || !reactionType) {
    return res.status(400).json({ error: "Invalid data." });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found." });

    // Tìm reaction của người dùng hiện tại và loại reaction khớp với reactionType
    const existingIndex = message.reactions.findIndex(
      r => r.user.toString() === userId.toString() && r.type === reactionType
    );

    if (existingIndex < 0) {
      return res.status(404).json({ error: "Reaction not found." });
    }

    // Xóa reaction được tìm thấy
    message.reactions.splice(existingIndex, 1);
    await message.save();

    res.status(200).json({ message: "Reaction deleted", reactions: message.reactions });
  } catch (err) {
    console.error("Delete reaction error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Xóa tất cả các reaction của người dùng hiện tại trong tin nhắn (DELETE /react/all)
// Yêu cầu: trong req.body cần có messageId
router.delete("/react/all", auth, async (req, res) => {
  const userId = req.user._id;
  const { messageId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ error: "Invalid messageId." });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found." });

    const prevCount = message.reactions.length;
    // Giữ lại các reaction không do người dùng hiện tại thêm vào
    message.reactions = message.reactions.filter(
      r => r.user.toString() !== userId.toString()
    );
    const deletedCount = prevCount - message.reactions.length;
    if (deletedCount === 0) {
      return res.status(404).json({ error: "No reactions to delete." });
    }

    await message.save();
    res.status(200).json({ message: "All user reactions deleted.", reactions: message.reactions });
  } catch (err) {
    console.error("Delete all reactions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
