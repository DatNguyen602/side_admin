const express = require("express");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Room = require("../models/Room");

const signalingRouter = express.Router();
const userSocketMap = new Map(); // userId => socket.id

const safeParse = (data) => {
    if (typeof data === "string") {
        try {
            return JSON.parse(data);
        } catch (err) {
            console.error("JSON parse error:", err.message);
            return null;
        }
    }
    return data;
};

const initializeSignaling = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.use(async (socket, next) => {
        const token = socket.handshake.headers?.token ?? socket.handshake.auth?.token;
        if (!token) {
            console.log("❌ No token provided");
            return next(new Error("Unauthorized"));
        }

        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = payload.id;
            next();
        } catch (err) {
            console.log("❌ Token verify failed:", err.message);
            next(new Error("Unauthorized"));
        }
    });

    io.on("connection", async (socket) => {
        console.log("User connected:", socket.id, "| userId:", socket.userId);

        socket.on("message", async (rawData) => {
            const parsed = safeParse(rawData);
            if (!parsed) return;

            const { event, data } = parsed;
            if (event && handleEvent[event]) {
                await handleEvent[event](socket, data, io);
            }
        });

        socket.on("disconnect", async () => {
            console.log("User disconnected:", socket.userId);

            for (const [uid, sid] of userSocketMap.entries()) {
                if (sid === socket.id) {
                    userSocketMap.delete(uid);
                    await User.findByIdAndUpdate({_id: uid} , { state: "offline" });
                    io.emit("user-state-change", { userId: uid, state: "offline" });
                    break;
                }
            }
        });
    });

    return io;
};

const handleEvent = {
    "setup": async (socket, data, io) => {
        const userId = socket.userId;
        const { deviceId, deviceName } = data;

        if (userId && deviceId) {
            userSocketMap.set(userId, socket.id);

            await User.findByIdAndUpdate(userId, {
                $addToSet: {
                    devices: {
                        deviceId,
                        deviceName,
                        lastActive: new Date(),
                    }
                },
                state: "online"
            });

            io.emit("user-state-change", { userId, state: "online" });
        }
    },

    "join": (socket, { roomId }, io) => {
        if (!roomId) return;
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
        socket.to(roomId).emit("joined", { socketId: socket.id });
    },

    "leave": (socket, { roomId }, io) => {
        if (!roomId) return;
        socket.leave(roomId);
        console.log(`Socket ${socket.id} left room ${roomId}`);
        socket.to(roomId).emit("left", { socketId: socket.id });
    },

    "offer": (socket, { roomId, offer }, io) => {
        if (!roomId || !offer) return;
        socket.to(roomId).emit("offer", { socketId: socket.id, offer });
    },

    "answer": (socket, { roomId, answer }, io) => {
        if (!roomId || !answer) return;
        socket.to(roomId).emit("answer", { socketId: socket.id, answer });
    },

    "candidate": (socket, { roomId, candidate }, io) => {
        if (!roomId || !candidate) return;
        socket.to(roomId).emit("candidate", { socketId: socket.id, candidate });
    },

    "ready": (socket, { roomId }, io) => {
        if (!roomId) return;
        socket.to(roomId).emit("ready", { socketId: socket.id });
    },

    "message": async (socket, { room, content }, io) => {
        const sender = socket.userId;
        if (!room || !content || !sender) return;

        const r = await Room.findById(room);
        if (!r || !r.members.some(m => m.user.toString() === sender.toString())) {
            io.to(room).emit("message", {
                socketId: socket.id,
                message: { error: "Room not found or access denied" }
            });
            return;
        }

        r.members.forEach((v, i) => {
            if(v.user.toString() !== sender.toString()){
                const socketId = userSocketMap.get(v.user.toString());
                if (socketId) {
                    io.to(socketId).emit("fetchmessage", {
                        message: { send: "Room not found or access denied" }
                    });
                }
            }
        });

        const saved = await Message.create({
            sender,
            room: r._id,
            contents: content,
            readBy: [sender]
        });

        io.to(room).emit("message", {
            socketId: socket.id,
            message: {
                _id: saved._id,
                sender,
                content: saved.content,
                timestamp: saved.createdAt
            }
        });
    },

    "private-message": async (socket, { toUserId, content }, io) => {
        const fromUserId = socket.userId;
        if (!toUserId || !content) return;

        let room = await Room.findOne({
            isGroup: false,
            members: { $all: [fromUserId, toUserId], $size: 2 }
        });

        if (!room) {
            room = await Room.create({
                isGroup: false,
                members: [fromUserId, toUserId]
            });
        }

        const saved = await Message.create({
            sender: fromUserId,
            room: room._id,
            content,
            readBy: [fromUserId]
        });

        const targetSocketId = userSocketMap.get(toUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit("private-message", {
                fromUserId,
                roomId: room._id,
                message: {
                    _id: saved._id,
                    content: saved.content,
                    timestamp: saved.createdAt
                }
            });
        }
    }
};

module.exports = { signalingRouter, initializeSignaling };
