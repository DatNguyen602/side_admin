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

    const user = await User.findOne({ username });
    if(!user) {
        fakeRes.status(400).json({ error: 'Invalid credentials' });
        return res.json(fakeRes);
    }
    const match = await require('bcrypt').compare(password, user.password);
    if(!match) {
        fakeRes.status(400).json({ error: 'Invalid credentials' });
        return res.json(fakeRes);
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    fakeRes.json({ token });

    if (fakeRes.statusCode < 400 && fakeRes.data?.token) {
        res.cookie("token", fakeRes.data.token, {
            httpOnly: true,
            sameSite: "lax",
        });
    }

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
        const rooms = await Room.find({ "members.user": userId })
            .populate("members", "username avatar state")
            .sort({ createdAt: -1 });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

const ENC_DIR = path.join(__dirname, "..", "uploads/uploads_encrypted");

router.get("/messages/:roomId", auth, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  try {
    const room = await Room.findOne({
      _id: roomId,
      "members.user": userId
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found!" });
    }

    let messages = await Message.find({ room: room.id })
      .populate("sender", "username avatar")
      .sort({ createdAt: 1 })
      .lean(); // Dùng lean để cho phép thêm trường tùy ý

    // Bổ sung originalName nếu có file
    for (let msg of messages) {
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
    }
    
    res.json(messages);
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