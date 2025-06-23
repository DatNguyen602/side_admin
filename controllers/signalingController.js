// server.js
const express = require("express");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Room = require("../models/Room");
const { default: mongoose } = require("mongoose");

const userSocketMap = new Map();
const rtcMapoffer = new Map();
const rtcMapcandidate = new Map();

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
        userSocketMap.set(socket.userId, socket.id);

        // Đón nhận các messageChat từ client
        socket.on("messageChat", async (rawData) => {
            const parsed = safeParse(rawData);
            if (!parsed) return;

            const { event, data } = parsed;
            if (event && handleEventChat[event]) {
                await handleEventChat[event](socket, data, io);
            }
        });

        socket.on("signal", async (rawData) => {
            const parsed = safeParse(rawData);
            if (!parsed) return;

            const { message, room } = parsed;
            // Lấy targetUserId từ payload nếu có, nếu không thì xác định từ room.members.
            let targetUserId = parsed.targetUserId;
            if (!targetUserId && room && room.members) {
                targetUserId = (
                    room.members.find((u) => u.user._id !== socket.userId) ?? {}
                ).user?._id;
            }
            if (!targetUserId) return;

            // Gán thông tin về người gửi và người nhận để phân biệt rõ trong quá trình setup.
            parsed.senderId = socket.userId;
            parsed.receiverId = targetUserId;

            // Có thể lưu lại các tín hiệu đặc biệt như "offer" hoặc "candidate" nếu cần xử lý lại (dùng để gọi lại nếu phía nhận đang offline)
            if (message.type === "offer") {
                rtcMapoffer.set(targetUserId, parsed);
            } else if (message.type === "candidate") {
                rtcMapcandidate.set(targetUserId, parsed);
            }

            // Hàm gửi tín hiệu đến tất cả các socket của target (người nhận)
            const sendToTarget = () => {
                const targetSockets = userSocketMap.get(targetUserId);
                if (targetSockets && targetSockets.size > 0) {
                    targetSockets.forEach((socketId) => {
                        io.to(socketId).emit("signal", parsed);
                    });
                    return true;
                }
                return false;
            };

            // Cố gắng gửi ngay tức thì
            if (!sendToTarget()) {
                // Nếu người nhận chưa online, chờ 3 giây rồi thử gửi lại.
                setTimeout(() => {
                    sendToTarget();
                }, 3000); // 3000 ms = 3 giây
            }
        });

        socket.on("getSignal", (data) => {
            const tOffer = rtcMapoffer.get(data.room._id);
            const tCandidate = rtcMapcandidate.get(data.room._id);
            io.to(socket.id).emit("signal", tOffer);
            io.to(socket.id).emit("signal", tCandidate);
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
const handleEventChat = {
    setup: async (socket, data, io) => {
        const userId = socket.userId;

        if (userId) {
            // Lưu socket id của user vào Map
            userSocketMap.set(userId, socket.id);

            await User.findByIdAndUpdate(userId, {
                state: "online",
            });

            io.emit("user-state-change", { userId, state: "online" });
        }
    },
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

        let saved = null;
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
    react: async (socket, { room, content }, io) => {
        const sender = socket.userId;
        if (!room || !sender) return;

        const r = await Room.findById(room);

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
    },
};

module.exports = { initializeSignaling };
