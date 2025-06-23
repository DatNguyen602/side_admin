const express = require("express");
const router = express.Router();
const SFURoom = require("../../../models/SFURoom");

// Middleware xác thực (giả sử req.user được thiết lập từ trước)
const authenticate = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    next();
};

/**
 * Hàm tạo router với tham số io (instance của Socket.IO)
 * Điều này cho phép các endpoint REST đẩy event realtime cho client.
 */
module.exports = (io) => {
    /* -------------------- Phần SFURoom -------------------- */

    // Tạo phòng SFU mới
    // POST /rooms/
    router.post("/", authenticate, async (req, res) => {
        try {
            const { name } = req.body;
            if (!name)
                return res.status(400).json({ error: "Room name is required" });
            const room = new SFURoom({
                name,
                owner: req.user.id,
                participants: [req.user.id],
            });
            await room.save();
            io.emit("sfu-room-updated", {
                roomId: room._id,
                action: "created",
                room,
            });
            res.status(201).json(room);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Lấy thông tin SFURoom bao gồm danh sách participant
    // GET /rooms//:id
    router.get("/:id", authenticate, async (req, res) => {
        try {
            const room = await SFURoom.findById(req.params.id).populate(
                "participants",
                "name email"
            );
            if (!room) return res.status(404).json({ error: "Room not found" });
            res.json(room);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Tham gia SFURoom
    // POST /rooms//:id/join
    router.post("/:id/join", authenticate, async (req, res) => {
        try {
            const room = await SFURoom.findById(req.params.id);
            if (!room) return res.status(404).json({ error: "Room not found" });
            if (!room.participants.includes(req.user.id)) {
                room.participants.push(req.user.id);
                await room.save();
                io.to(room._id.toString()).emit("sfu-room-updated", {
                    roomId: room._id,
                    action: "participant-joined",
                    userId: req.user.id,
                });
            }
            res.json(room);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Rời SFURoom
    // POST /rooms//:id/leave
    router.post("/:id/leave", authenticate, async (req, res) => {
        try {
            const room = await SFURoom.findById(req.params.id);
            if (!room) return res.status(404).json({ error: "Room not found" });
            room.participants = room.participants.filter(
                (uid) => uid.toString() !== req.user.id
            );
            await room.save();
            io.to(room._id.toString()).emit("sfu-room-updated", {
                roomId: room._id,
                action: "participant-left",
                userId: req.user.id,
            });
            res.json({ message: "Left SFU room successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Các endpoint cập nhật trạng thái streaming cho SFURoom (chỉ áp dụng cho phòng họp)
    // Bắt đầu chia sẻ video camera
    // POST /rooms//:id/streams/camera/start
    router.post(
        "/:id/streams/camera/start",
        authenticate,
        async (req, res) => {
            try {
                const room = await SFURoom.findById(req.params.id);
                if (!room)
                    return res.status(404).json({ error: "Room not found" });
                room.streaming.camera = true;
                await room.save();
                io.to(room._id.toString()).emit("sfu-stream", {
                    roomId: room._id,
                    userId: req.user.id,
                    stream: "camera",
                    status: "started",
                });
                res.json({ message: "Camera stream started" });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Internal server error" });
            }
        }
    );

    // Dừng chia sẻ video camera
    // POST /rooms//:id/streams/camera/stop
    router.post(
        "/:id/streams/camera/stop",
        authenticate,
        async (req, res) => {
            try {
                const room = await SFURoom.findById(req.params.id);
                if (!room)
                    return res.status(404).json({ error: "Room not found" });
                room.streaming.camera = false;
                await room.save();
                io.to(room._id.toString()).emit("sfu-stream", {
                    roomId: room._id,
                    userId: req.user.id,
                    stream: "camera",
                    status: "stopped",
                });
                res.json({ message: "Camera stream stopped" });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Internal server error" });
            }
        }
    );

    // Bắt đầu chia sẻ màn hình
    // POST /rooms//:id/streams/screen/start
    router.post(
        "/:id/streams/screen/start",
        authenticate,
        async (req, res) => {
            try {
                const room = await SFURoom.findById(req.params.id);
                if (!room)
                    return res.status(404).json({ error: "Room not found" });
                room.streaming.screen = true;
                await room.save();
                io.to(room._id.toString()).emit("sfu-stream", {
                    roomId: room._id,
                    userId: req.user.id,
                    stream: "screen",
                    status: "started",
                });
                res.json({ message: "Screen sharing started" });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Internal server error" });
            }
        }
    );

    // Dừng chia sẻ màn hình
    // POST /rooms//:id/streams/screen/stop
    router.post(
        "/:id/streams/screen/stop",
        authenticate,
        async (req, res) => {
            try {
                const room = await SFURoom.findById(req.params.id);
                if (!room)
                    return res.status(404).json({ error: "Room not found" });
                room.streaming.screen = false;
                await room.save();
                io.to(room._id.toString()).emit("sfu-stream", {
                    roomId: room._id,
                    userId: req.user.id,
                    stream: "screen",
                    status: "stopped",
                });
                res.json({ message: "Screen sharing stopped" });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Internal server error" });
            }
        }
    );

    return router;
};
