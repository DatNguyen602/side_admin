// server.js
const express = require("express");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Room = require("../models/Room");
const { default: mongoose } = require("mongoose");

const signalingRouter = express.Router();
const userSocketMap = new Map(); // Map userId => socket.id

// Hàm an toàn phân tích JSON
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

// Khởi tạo Signaling server với Socket.IO
const initializeSignaling = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    // Middleware xác thực JWT cho kết nối WebSocket
    io.use(async (socket, next) => {
        const token =
            socket.handshake.headers?.token || socket.handshake.auth?.token;
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

    // Xử lý kết nối
    io.on("connection", async (socket) => {
        console.log("User connected:", socket.id, "| userId:", socket.userId);

        // Đón nhận các message từ client
        socket.on("message", async (rawData) => {
            const parsed = safeParse(rawData);
            if (!parsed) return;

            const { event, data } = parsed;
            if (event && handleEvent[event]) {
                await handleEvent[event](socket, data, io);
            }
        });

        // Xử lý disconnect
        socket.on("disconnect", async () => {
            console.log("User disconnected:", socket.userId);
            // Xoá socket của user khỏi Map
            for (const [uid, sid] of userSocketMap.entries()) {
                if (sid === socket.id) {
                    userSocketMap.delete(uid);
                    await User.findByIdAndUpdate(
                        { _id: uid },
                        { state: "offline" }
                    );
                    io.emit("user-state-change", {
                        userId: uid,
                        state: "offline",
                    });
                    break;
                }
            }
        });
    });

    return io;
};

// Xử lý các sự kiện từ phía client
const handleEvent = {
    // Khi client gửi sự kiện setup để đăng ký thông tin của mình (như device info) lên server
    setup: async (socket, data, io) => {
        const userId = socket.userId;
        const { deviceId, deviceName } = data;

        if (userId && deviceId) {
            // Lưu socket id của user vào Map
            userSocketMap.set(userId, socket.id);

            await User.findByIdAndUpdate(userId, {
                state: "online",
            });

            io.emit("user-state-change", { userId, state: "online" });
        }
    },

    // Sự kiện chat message (ví dụ trong room)
    message: async (socket, { room, content }, io) => {
        const sender = socket.userId;
        if (!room || !content || !sender) return;

        const r = await Room.findById(room);
        if (
            !r ||
            !r.members.some((m) => m.user.toString() === sender.toString())
        ) {
            io.to(room).emit("message", {
                socketId: socket.id,
                message: { error: "Room not found or access denied" },
            });
            return;
        }

        const saved = null;
        try {
            saved = await Message.create({
                sender,
                room: r._id,
                contents: content,
                readBy: [new mongoose.Types.ObjectId(sender)],
            });
        } catch (err) {
            console.log(err);
        }

        if (saved) {
            r.members.forEach((v) => {
                if (v.user.toString() !== sender.toString()) {
                    const socketId = userSocketMap.get(v.user.toString());
                    if (socketId) {
                        console.log(socketId);
                        io.to(socketId).emit("fetchmessage", {
                            message: { info: "New message in room" },
                        });
                    }
                }
            });

            io.to(room).emit("message", {
                socketId: socket.id,
                message: {
                    _id: saved._id,
                    sender,
                    content: saved.content,
                    timestamp: saved.createdAt,
                },
            });
        }
    },

    // Sự kiện WebRTC: offer
    "webrtc-offer": async (socket, data, io) => {
        // data cần chứa: { to: targetUserId, offer: offerObject }
        const targetSocketId = userSocketMap.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit(
                "message",
                JSON.stringify({
                    event: "webrtc-offer",
                    data: {
                        from: socket.userId,
                        offer: data.offer,
                    },
                })
            );
            console.log(
                `[Signaling] Sent webrtc-offer from ${socket.userId} to ${data.to}`
            );
        } else {
            console.warn("Target socket not found for webrtc-offer", data.to);
        }
    },

    // Sự kiện WebRTC: answer
    "webrtc-answer": async (socket, data, io) => {
        // data cần chứa: { to: targetUserId, answer: answerObject }
        const targetSocketId = userSocketMap.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit(
                "message",
                JSON.stringify({
                    event: "webrtc-answer",
                    data: {
                        from: socket.userId,
                        answer: data.answer,
                    },
                })
            );
            console.log(
                `[Signaling] Sent webrtc-answer from ${socket.userId} to ${data.to}`
            );
        } else {
            console.warn("Target socket not found for webrtc-answer", data.to);
        }
    },

    // Sự kiện WebRTC: candidate
    "webrtc-candidate": async (socket, data, io) => {
        // data cần chứa: { to: targetUserId, candidate: candidateObject }
        const targetSocketId = userSocketMap.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit(
                "message",
                JSON.stringify({
                    event: "webrtc-candidate",
                    data: {
                        from: socket.userId,
                        candidate: data.candidate,
                    },
                })
            );
            console.log(
                `[Signaling] Sent webrtc-candidate from ${socket.userId} to ${data.to}`
            );
        } else {
            console.warn(
                "Target socket not found for webrtc-candidate",
                data.to
            );
        }
    },

    // Sự kiện WebRTC: hangup
    "webrtc-hangup": async (socket, data, io) => {
        // data cần chứa: { to: targetUserId }
        const targetSocketId = userSocketMap.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit(
                "message",
                JSON.stringify({
                    event: "webrtc-hangup",
                    data: {
                        from: socket.userId,
                    },
                })
            );
            console.log(
                `[Signaling] Sent webrtc-hangup from ${socket.userId} to ${data.to}`
            );
        } else {
            console.warn("Target socket not found for webrtc-hangup", data.to);
        }
    },
};

module.exports = { signalingRouter, initializeSignaling };
