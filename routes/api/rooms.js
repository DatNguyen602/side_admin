// routes/api/rooms.js
const router = require("express").Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const Room = require("../../models/Room");
const Message = require("../../models/Message");
const mongoose = require("mongoose");

router.get("/", auth, async (req, res) => {
    const userId = req.user.id;
    try {
        // Lấy rooms mà user tham gia, populate thông tin member.user
        const rooms = await Room.find({ "members.user": userId })
            .populate("members.user", "username avatar state")
            .sort({ createdAt: -1 });

        // Tạo response với name theo yêu cầu
        const roomsWithName = await Promise.all( rooms.map(async (room) => {
            // Chuyển từ Mongoose doc sang object để dễ thao tác
            const roomObj = room.toObject();
            const mesNew = await Message.findOne({ room: roomObj._id })
              .sort({ createdAt: -1 });

            if (!roomObj.isGroup && roomObj.members.length === 2) {
                // Tìm member không phải user hiện tại
                const otherMember = roomObj.members.find(
                    (m) => m.user._id.toString() !== userId.toString()
                );
                // Gán name = username của người đó (nếu có)
                roomObj.name = otherMember?.user?.username || "Unknown";
                roomObj.icon = otherMember?.user?.avatar || "";
            }

            if(mesNew) {
              if(!mesNew.readBy.includes(userId)) roomObj.newMessage = mesNew.contents[0].data;
              roomObj.newDate = mesNew.createdAt
            }
            // Ngược lại giữ nguyên hoặc có thể giữ name hiện tại nếu có
            return roomObj;
        }))
        roomsWithName.sort((a, b) => {
            if (a.newDate && b.newDate) {
                return b.newDate - a.newDate;
            } else if (a.newDate) {
                return -1;
            } else if (b.newDate) {
                return 1;
            } else {
                return 0;
            }
        });

        res.json(roomsWithName);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/approve-join", auth, async (req, res) => {
  const { roomId, userIdToApprove } = req.body;
  const currentUser = req.user.id;
  
  try {
    // Kiểm tra định dạng roomId
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ error: "Invalid room ID." });
    }
    
    // Tìm phòng
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found." });
    
    // Kiểm tra quyền: chỉ creator (hoặc admin) mới có quyền duyệt yêu cầu gia nhập
    const currentMember = room.members.find(
      (member) => member.user.toString() === currentUser.toString()
    );
    if (!currentMember || (currentMember.role !== "creator" && currentMember.role !== "admin")) {
      return res.status(403).json({ error: "Not authorized to approve join requests." });
    }
    
    // Tìm yêu cầu gia nhập của user cần được duyệt
    const requestIndex = room.joinRequests.findIndex(
      (req) => req.user.toString() === userIdToApprove.toString()
    );
    if (requestIndex === -1) {
      return res.status(400).json({ error: "Join request not found." });
    }
    
    // Xóa yêu cầu gia nhập và thêm người đó vào danh sách members
    room.joinRequests.splice(requestIndex, 1);
    room.members.push({ user: userIdToApprove, role: "member" });
    await room.save();
    
    res.status(200).json({ message: "Join request approved.", room });
  } catch (err) {
    console.error("Error approving join request:", err);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/create", auth, async (req, res) => {
  try {
    const { name, memberIds, joinPolicy } = req.body;
    const creatorId = req.user.id;

    // Xác thực đầu vào:
    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Room name is required and cannot be empty." });
    }
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ error: "memberIds must be an array." });
    }

    // Loại bỏ các ID trùng lặp, đảm bảo creator luôn có trong danh sách
    const allMemberIds = [...new Set([...memberIds, creatorId])];

    // Kiểm tra sự tồn tại của các thành viên hợp lệ
    const users = await User.find({ _id: { $in: allMemberIds } }).select("_id");
    const validUserIds = users.map((user) => user._id.toString());

    // Yêu cầu tối thiểu là 3 thành viên (bao gồm cả người tạo)
    if (validUserIds.length < 3) {
      return res.status(400).json({
        error: "At least 3 valid users are required to create a group.",
      });
    }

    // Xây dựng danh sách thành viên với vai trò phù hợp
    const members = validUserIds.map((id) => ({
      user: id,
      role: id === creatorId ? "creator" : "member",
    }));

    // Tạo room, có thể cho phép truyền joinPolicy (đảm bảo chỉ nhận các giá trị hợp lệ)
    const room = new Room({
      name: name.trim(),
      isGroup: true,
      joinPolicy: joinPolicy && ["free", "approval"].includes(joinPolicy) ? joinPolicy : "free",
      members,
    });

    await room.save();
    res.status(201).json(room);
  } catch (err) {
    console.error("Room create error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/add", auth, async (req, res) => {
    const { roomId, memberIds } = req.body;
    const userId = req.user.id;

    try {
        // Kiểm tra định dạng roomId
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({ error: "Invalid room ID." });
        }
        // Kiểm tra memberIds phải là một mảng có giá trị
        if (!Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ error: "memberIds must be a non-empty array." });
        }
        
        // Loại bỏ các ID trùng lặp
        const uniqueMemberIds = [...new Set(memberIds)];

        // Tìm phòng theo roomId
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ error: "Room not found." });
        }

        // Xác nhận rằng người gọi API có quyền thêm thành viên (ở đây yêu cầu role "creator")
        const currentMember = room.members.find(
            (member) => member.user.toString() === userId.toString()
        );
        if (!currentMember || currentMember.role !== "creator") {
            return res.status(403).json({ error: "Not authorized to add members to this room." });
        }

        // Lấy danh sách các thành viên hiện tại
        const currentMemberIds = room.members.map((m) => m.user.toString());

        // Lọc ra các memberIds chưa có trong room và kiểm tra tính hợp lệ (có tồn tại trong CSDL)
        const validUsers = await User.find({ _id: { $in: uniqueMemberIds } }).select("_id");
        const validUserIds = validUsers.map((u) => u._id.toString()).filter(id => !currentMemberIds.includes(id));

        if (validUserIds.length === 0) {
            return res.status(400).json({ error: "No valid new members provided." });
        }

        // Thêm các thành viên mới với role "member"
        validUserIds.forEach(id => {
            room.members.push({ user: id, role: "member" });
        });

        await room.save();
        res.status(200).json({ message: "Members added successfully.", room });
    } catch (err) {
        console.error("Error adding members to room:", err);
        res.status(500).json({ error: "Server error." });
    }
});

router.post("/join", auth, async (req, res) => {
  const { roomId } = req.body;
  const userId = req.user.id;

  try {
    // Kiểm tra định dạng roomId
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ error: "Invalid room ID." });
    }

    // Tìm room dựa trên roomId
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    // Kiểm tra nếu người dùng đã là member
    if (room.members.some((member) => member.user.toString() === userId)) {
      return res.status(400).json({ error: "You are already a member of this room." });
    }

    if (room.joinPolicy === "free") {
      // Thêm luôn người dùng vào members khi joinPolicy cho phép tự do
      room.members.push({ user: userId, role: "member" });
      await room.save();
      return res.status(200).json({ message: "Successfully joined the room.", room });
    } else if (room.joinPolicy === "approval") {
      // Nếu đã yêu cầu gia nhập rồi thì không cho lặp lại
      if (room.joinRequests.some((req) => req.user.toString() === userId)) {
        return res.status(400).json({ error: "You have already requested to join this room." });
      }
      // Thêm yêu cầu gia nhập
      room.joinRequests.push({ user: userId });
      await room.save();
      return res.status(200).json({ message: "Join request submitted. Wait for approval.", room });
    }
  } catch (err) {
    console.error("Error joining room:", err);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/role", auth, async (req, res) => {
    const { roomId, targetUserId, newRole } = req.body;
    const userId = req.user.id;

    const validRoles = ["admin", "member", "creator"];
    if (!validRoles.includes(newRole)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    try {
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: "Room not found" });

        // Kiểm tra người gọi là creator hiện tại
        const currentCreator = room.members.find((m) => m.role === "creator");
        if (!currentCreator || currentCreator.user.toString() !== userId) {
            return res
                .status(403)
                .json({ error: "Only the creator can change roles" });
        }

        const targetMember = room.members.find(
            (m) => m.user.toString() === targetUserId
        );
        if (!targetMember)
            return res.status(404).json({ error: "Target user not in room" });

        if (newRole === "creator") {
            // Trao quyền creator cho người khác
            currentCreator.role = "admin";
            targetMember.role = "creator";
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

module.exports = router;
