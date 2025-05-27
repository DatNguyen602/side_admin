// routes/users.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { list, get } = require('../controllers/userController');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Room = require('../models/Room');
const Message = require('../models/Message');

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
    console.log(userId1 + '\n' + userId2);
    try {
        let existingRoom = await Room.findOne({
            isGroup: false,
            members: { $all: [userId1, userId2], $size: 2 }
        });

        if (existingRoom) return res.json(existingRoom);

        const newRoom = new Room({
            isGroup: false,
            members: [userId1, userId2]
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
        const rooms = await Room.find({ members: userId })
            .populate("members", "username avatar state")
            .sort({ createdAt: -1 });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/messages/:roomId", async (req, res) => {
    const { roomId } = req.params;
    try {
        const messages = await Message.find({ room: roomId })
            .populate("sender", "username avatar")
            .sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/list", async (req, res) => {
    const users = await User.find().select("_id username avatar email");
    res.json(users);
})

router.post("/rooms/create", auth, async (req, res) => {
    const { name, memberIds } = req.body;

    try {
        const allMemberIds = [...new Set([...memberIds, req.user.id])]; // loại bỏ trùng lặp
        const existingUsers = await User.find({ _id: { $in: allMemberIds } }).select('_id');

        const validUserIds = existingUsers.map(user => user._id.toString());

        if (validUserIds.length < 3) {
            return res.status(400).json({ error: "At least 3 valid users required to create a group" });
        }

        const room = new Room({
            name,
            isGroup: true,
            members: validUserIds
        });

        await room.save();
        res.json(room);
    } catch (err) {
        console.error("Room create error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/rooms/join", auth, async (req, res) => {
    const { roomId } = req.body;
    const userId = req.user.id;
    try {
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: "Room not found" });

        if (!room.members.includes(userId)) {
            room.members.push(userId);
            await room.save();
        }

        res.json(room);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.use(auth);
router.get('/', rbac('user:read'), list);
router.get('/:id', rbac('user:read'), get);
module.exports = router;