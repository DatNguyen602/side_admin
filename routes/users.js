// routes/users.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { list, get } = require('../controllers/userController');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Room = require('../models/Room');
const Message = require('../models/Message');
const path = require("path");
const fs = require("fs");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const fakeRes = {
      statusCode: 200,
      data: null,
      json(obj) { this.data = obj; },
      status(code) { this.statusCode = code; return this; },
    };

    await login({ body: { username, password } }, fakeRes);

    if (fakeRes.statusCode >= 400 || !fakeRes.data?.token) {
      return res.render("login", {
        title: "Đăng nhập",
        error: fakeRes.data?.error || "Đăng nhập thất bại",
        query: req.query,
      });
    }

    res.cookie("token", fakeRes.data.token, {
      httpOnly: true,
      sameSite: "lax",
    });

    res.json(fakeRes);
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

router.get('/temp', auth, (req, res) => {
    console.log("user");
    console.log(req.user);
    res.status(200).json({ alert: "Test server" });
})

router.post("/friends/add", auth, async (req, res) => {
    const userId1 = req.user.id;
    const { userId2 } = req.body;

    try {
        let existingRoom = await Room.findOne({
            isGroup: false,
            members: {
                $all: [
                    { $elemMatch: { user: userId1 } },
                    { $elemMatch: { user: userId2 } }
                ],
                $size: 2
            }
        });

        if (existingRoom) return res.json(existingRoom);

        const newRoom = new Room({
            isGroup: false,
            members: [
                { user: userId1, role: "member" },
                { user: userId2, role: "member" }
            ]
        });

        await newRoom.save();
        res.json(newRoom);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/rooms", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    // Lấy rooms mà user tham gia, populate thông tin member.user
    const rooms = await Room.find({ "members.user": userId })
      .populate("members.user", "username avatar state")
      .sort({ createdAt: -1 });

    // Tạo response với name theo yêu cầu
    const roomsWithName = rooms.map(room => {
      // Chuyển từ Mongoose doc sang object để dễ thao tác
      const roomObj = room.toObject();

      if (!roomObj.isGroup && roomObj.members.length === 2) {
        // Tìm member không phải user hiện tại
        const otherMember = roomObj.members.find(m => m.user._id.toString() !== userId);
        // Gán name = username của người đó (nếu có)
        roomObj.name = otherMember?.user?.username || "Unknown";
      }
      // Ngược lại giữ nguyên hoặc có thể giữ name hiện tại nếu có
      return roomObj;
    });

    res.json(roomsWithName);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

const ENC_DIR = path.join(__dirname, "..", "uploads/uploads_encrypted");

router.get("/messages/:roomId", auth, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;
  // Lấy offset và limit từ query params
  const limit = Math.min(parseInt(req.query.limit) || 30, 100); // max 100
  const offset = parseInt(req.query.offset) || 0;

  try {
    // Kiểm tra user có trong room không
    const room = await Room.findOne({
      _id: roomId,
      "members.user": userId
    });
    if (!room) return res.status(404).json({ error: "Room not found!" });

    // Lấy tin nhắn theo phân trang offset + limit
    let messages = await Message.find({$and: [{ room: roomId }, {deletedBy: { $ne: userId }}]})
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("sender", "username avatar")
      .lean();

    const messageIds = messages.map(msg => msg._id);
        await Message.updateMany(
        { _id: { $in: messageIds } },
        { $addToSet: { readBy: userId } }
    );

    // Thêm originalName cho file (nếu có)
    messages = messages.map(msg => {
      if (msg.contents) {
        msg.contents = msg.contents.map(i => {
          if (i.type !== "text") {
            const metaPath = path.join(ENC_DIR, i.data + ".meta.json");
            if (fs.existsSync(metaPath)) {
              const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
              return {
                ...i,
                originalName: meta.originalName
              };
            }
          }
          return i;
        });
      }
      return {
        ...msg,
        sendBy: msg.sender._id.toString() === userId.toString() ? "you" : "other"
      };
    });

    for(let i = 0; i < messages.length ; i++){
      const senderAvatar = await User.findById(messages[i].sender._id);
      if(senderAvatar) {
        messages[i] = {
            ...messages[i],
            senderAvatar: senderAvatar.avatar
        }
      }
    }

    messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const members = await Promise.all(
      room.members.map(async (m) => {
        const u = await User.findById(m.user).select("_id username avatar email");
        return u;
      })
    );

    const roomObj = room.toObject();
    roomObj.members = members;

    if (!roomObj.isGroup && roomObj.members.length === 2) {
      roomObj.name = members.find(m => m._id.toString() !== userId.toString()).username;
    }

    res.json({ messages, room: roomObj, offset, limit });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/list", async (req, res) => {
    const users = await User.find().select("_id username avatar email");
    res.json(users);
})

router.post("/rooms/create", auth, async (req, res) => {
    const { name, memberIds } = req.body;
    const creatorId = req.user.id;

    try {
        const allMemberIds = [...new Set([...memberIds, creatorId])];
        const users = await User.find({ _id: { $in: allMemberIds } }).select("_id");

        const validUserIds = users.map(user => user._id.toString());
        if (validUserIds.length < 3) {
            return res.status(400).json({ error: "At least 3 valid users required to create a group" });
        }

        const members = validUserIds.map(id => ({
            user: id,
            role: id === creatorId ? 'creator' : 'member'
        }));

        const room = new Room({
            name,
            isGroup: true,
            members
        });

        await room.save();
        res.json(room);
    } catch (err) {
        console.error("Room create error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/rooms/role", auth, async (req, res) => {
    const { roomId, targetUserId, newRole } = req.body;
    const userId = req.user.id;

    const validRoles = ['admin', 'member', 'creator'];
    if (!validRoles.includes(newRole)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    try {
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: "Room not found" });

        // Kiểm tra người gọi là creator hiện tại
        const currentCreator = room.members.find(m => m.role === 'creator');
        if (!currentCreator || currentCreator.user.toString() !== userId) {
            return res.status(403).json({ error: "Only the creator can change roles" });
        }

        const targetMember = room.members.find(m => m.user.toString() === targetUserId);
        if (!targetMember) return res.status(404).json({ error: "Target user not in room" });

        if (newRole === 'creator') {
            // Trao quyền creator cho người khác
            currentCreator.role = 'admin';
            targetMember.role = 'creator';
        } else {
            // Chỉ đổi sang admin hoặc member
            targetMember.role = newRole;
        }

        await room.save();
        res.json(room);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.use(auth);
router.get('/', rbac('user:read'), list);
router.get('/:id', rbac('user:read'), get);
module.exports = router;