const express = require("express");
const { Server } = require("socket.io");
const User = require("../models/User");
const mediasoup = require("mediasoup");

const signalingRouter = express.Router();
const userSocketMap = new Map(); // userId => socket.id
const rooms = new Map(); // roomId => mediasoup Router

// Khởi tạo MediaSoup
const initializeMediasoup = async () => {
    const worker = await mediasoup.createWorker();
    return await worker.createRouter({ mediaCodecs: [
        { kind: "audio", mimeType: "audio/opus", clockRate: 48000 },
        { kind: "video", mimeType: "video/H264", clockRate: 90000 }
    ]});
};

const initializeSignaling = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", async (socket) => {
        console.log("User connected:", socket.id);

        const { userId, deviceId, deviceName } = socket.handshake.query;

        if (userId && deviceId) {
            console.log("Handshake info:", { userId, deviceId, deviceName });
            userSocketMap.set(userId, socket.id);

            // Optional: cập nhật thiết bị cuối cùng
            // await User.findByIdAndUpdate(userId, {
            //     $set: { lastDevice: { id: deviceId, name: deviceName } }
            // });
        }

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

        const handleEvent = (eventName, callback) => {
            socket.on(eventName, (rawData) => {
                const data = safeParse(rawData);
                console.log(data);
                if (data) callback(data);
            });
        };

        handleEvent("create", ({ roomId }) => {
            console.log("create: " + roomId);
        });

        handleEvent("join", ({ roomId }) => {
            if (!roomId) return;
            socket.join(roomId);
            console.log(`Socket ${socket.id} joined room ${roomId}`);
            socket.to(roomId).emit("joined", { socketId: socket.id });
        });

        handleEvent("leave", ({ roomId }) => {
            if (!roomId) return;
            socket.leave(roomId);
            console.log(`Socket ${socket.id} left room ${roomId}`);
            socket.to(roomId).emit("left", { socketId: socket.id });
        });

        handleEvent("offer", ({ roomId, offer }) => {
            if (!roomId || !offer) return;
            console.log(`Offer from ${socket.id} to room ${roomId}`);
            socket.to(roomId).emit("offer", { socketId: socket.id, offer });
        });

        handleEvent("answer", ({ roomId, answer }) => {
            if (!roomId || !answer) return;
            console.log(`Answer from ${socket.id} to room ${roomId}`);
            socket.to(roomId).emit("answer", { socketId: socket.id, answer });
        });

        handleEvent("candidate", ({ roomId, candidate }) => {
            if (!roomId || !candidate) return;
            console.log(`Candidate from ${socket.id} to room ${roomId}`);
            socket.to(roomId).emit("candidate", { socketId: socket.id, candidate });
        });

        handleEvent("ready", ({ roomId }) => {
            if (!roomId) return;
            console.log(`Socket ${socket.id} is ready in room ${roomId}`);
            socket.to(roomId).emit("ready", { socketId: socket.id });
        });

        handleEvent("message", ({ roomId, message }) => {
            if (!roomId || !message) return;
            console.log(`Message from ${socket.id} to room ${roomId}:`, message);
            socket.to(roomId).emit("message", { socketId: socket.id, message });
        });

        handleEvent("private-message", ({ toUserId, message }) => {
            if (!toUserId || !message) return;
            const targetSocketId = userSocketMap.get(toUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit("private-message", {
                    fromUserId: userId,
                    fromSocketId: socket.id,
                    message
                });
                console.log(`Private message from ${socket.id} to user ${toUserId}:`, message);
            } else {
                console.warn(`User ${toUserId} is not connected.`);
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);

            for (const [uid, sid] of userSocketMap.entries()) {
                if (sid === socket.id) {
                    userSocketMap.delete(uid);
                    break;
                }
            }
        });
    });

    return io;
};

module.exports = { signalingRouter, initializeSignaling };
