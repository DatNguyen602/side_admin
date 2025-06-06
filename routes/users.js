// routes/users.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const rbac = require("../middleware/rbac");
const { login } = require("../controllers/authController");
const { list, get } = require("../controllers/userController");
const User = require("../models/User");
const Room = require("../models/Room");
const FriendRequest = require("../models/FriendRequest");
const escapeStringRegexp = require("escape-string-regexp");
const mongoose = require("mongoose");

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const fakeRes = {
            statusCode: 200,
            data: null,
            json(obj) {
                this.data = obj;
            },
            status(code) {
                this.statusCode = code;
                return this;
            },
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

router.get("/temp", auth, (req, res) => {
    console.log("user");
    console.log(req.user);
    res.status(200).json({ alert: "Test server" });
});

router.get("/profile", auth, async (req, res) => {
  const { password, ...user} = req.user;
  return res.json({
    ...user,
    avatar: user.avatar ?? process.env.DOMAIN + "/uploads/avatars/default-avatar.png"
  });
})

router.post("/friends/add", auth, async (req, res) => {
    const userId1 = req.user._id;
    const { userId2 } = req.body;

    try {
        let existingRoom = await Room.findOne({
            isGroup: false,
            members: {
                $all: [
                    { $elemMatch: { user: userId1 } },
                    { $elemMatch: { user: userId2 } },
                ],
                $size: 2,
            },
        });

        if (existingRoom) return res.json(existingRoom);

        const newRoom = new Room({
            isGroup: false,
            members: [
                { user: userId1, role: "member" },
                { user: userId2, role: "member" },
            ],
        });

        await newRoom.save();
        res.json(newRoom);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * POST /friends/request
 * Gửi yêu cầu kết bạn cho targetUserId.
 */
router.post("/friends/request", auth, async (req, res) => {
  const requester = req.user._id;
  const { targetUserId } = req.body;
  console.log(requester + "\n" + targetUserId)
  
  // Kiểm tra targetUserId hợp lệ và không tự gửi
  if (!mongoose.Types.ObjectId.isValid(targetUserId) || targetUserId === requester) {
    return res.status(400).json({ error: "Invalid target user." });
  }
  
  try {
    // Kiểm tra nếu đã có yêu cầu pending
    const existingRequest = await FriendRequest.findOne({ 
      $or: [
        { requester: requester, target: targetUserId },
        { requester: targetUserId, target: requester }
      ] 
    }).lean();
    if (existingRequest) {
      return res.status(400).json({ error: "Friend request already sent." });
    }

    // Tạo yêu cầu kết bạn mới
    const fr = new FriendRequest({
      requester,
      target: targetUserId
    });
    await fr.save();
    res.status(200).json({ message: "Friend request sent.", request: fr });
  } catch (err) {
    console.error("Error sending friend request:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /friends/requests
 * Lấy danh sách yêu cầu kết bạn nhận được (đang ở trạng thái pending).
 */
router.get("/friends/requests", auth, async (req, res) => {
  const userId = req.user._id;
  try {
    const requests = await FriendRequest.find({
      target: userId,
      status: "pending"
    }).populate("requester", "username avatar email");
    res.json(requests);
  } catch (err) {
    console.error("Error fetching friend requests:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /friends/accept
 * Chấp nhận yêu cầu kết bạn.
 * Payload: { friendRequestId }
 * Sau khi chấp nhận, nếu chưa có phòng trò chuyện 1-1, tự động tạo.
 */
router.post("/friends/accept", auth, async (req, res) => {
  const userId = req.user._id;
  const { friendRequestId } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(friendRequestId)) {
    return res.status(400).json({ error: "Invalid friend request id." });
  }
  
  try {
    const fr = await FriendRequest.findById(friendRequestId);
    if (!fr) return res.status(404).json({ error: "Friend request not found." });
    if (fr.target.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to accept this request." });
    }
    if (fr.status !== "pending") {
      return res.status(400).json({ error: "Friend request is not pending." });
    }
    
    // Cập nhật trạng thái yêu cầu
    fr.status = "accepted";
    await fr.save();
    
    // Kiểm tra lại nếu đã có phòng không nhóm giữa 2 bên, nếu chưa, tạo mới
    let room = await Room.findOne({
      isGroup: false,
      members: {
        $all: [
          { $elemMatch: { user: fr.requester } },
          { $elemMatch: { user: fr.target } }
        ],
        $size: 2
      }
    });
    if (!room) {
      const newRoom = new Room({
        isGroup: false,
        members: [
          { user: fr.requester, role: "member" },
          { user: fr.target, role: "member" }
        ]
      });
      room = await newRoom.save();
    }
    
    res.json({ message: "Friend request accepted.", room });
  } catch (err) {
    console.error("Error accepting friend request:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /friends/decline
 * Từ chối yêu cầu kết bạn.
 * Payload: { friendRequestId }
 */
router.post("/friends/decline", auth, async (req, res) => {
  const userId = req.user._id;
  const { friendRequestId } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(friendRequestId)) {
    return res.status(400).json({ error: "Invalid friend request id." });
  }
  
  try {
    const fr = await FriendRequest.findById(friendRequestId);
    if (!fr) return res.status(404).json({ error: "Friend request not found." });
    if (fr.target.toString() !== userId) {
      return res.status(403).json({ error: "Not authorized to decline this request." });
    }
    if (fr.status !== "pending") {
      return res.status(400).json({ error: "Friend request is not pending." });
    }
    fr.status = "declined";
    await fr.save();
    res.json({ message: "Friend request declined." });
  } catch (err) {
    console.error("Error declining friend request:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /friends/list
 * Lấy danh sách bạn bè dựa trên các phòng (chat 1-1)
 * Người dùng đã có trong room không nhóm thì bạn của họ là thành viên
 * còn lại trong room.
 */
router.get("/friends/list", auth, async (req, res) => {
  const userId = req.user._id;
  try {
    const rooms = await Room.find({
      isGroup: false,
      members: { $elemMatch: { user: userId } }
    }).populate("members.user", "username avatar email").lean();

    const friends = rooms.map((room) => {
      const other = room.members.find(m => m.user._id.toString() !== userId.toString());
      return other ? { 
        ...other.user, 
        idChat: room._id, 
        isGroup: room.isGroup 
      } : null;
    }).filter(Boolean);

    const friendIds = new Set();
    const uniqueFriends = await Promise.all(
      friends.map(async (f) => {
        try {
          const tfb = await FriendRequest.findOne({ 
            $or: [
              { requester: userId, target: f._id, status: "accepted" },
              { requester: f._id, target: userId, status: "accepted" }
            ] 
          }).lean();

          if (tfb) {
            friendIds.add(f._id.toString());
            return {
              ...f,
              idFr: tfb._id
            };
          }
        } catch (error) {
          console.error(`Error checking friend request for ${f.username}:`, error);
        }
        return null;
      })
    );

    res.json(uniqueFriends.filter(Boolean)); 
  } catch (err) {
    console.error("Error fetching friend list:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/list", async (req, res) => {
    const users = await User.find().select("_id username avatar email");
    res.json(users);
});
router.post("/find", auth, async (req, res) => {
    const userId = req.user._id;
    try {
        let searchQuery = req.body.q;
        if (typeof searchQuery !== "string") {
            return res
                .status(400)
                .json({ error: "Từ khóa tìm kiếm không hợp lệ." });
        }
        searchQuery = searchQuery.trim();
        if (searchQuery.length === 0) {
            return res
                .status(400)
                .json({ error: "Từ khóa không được để trống." });
        }
        if (searchQuery.length > 100) {
            return res.status(400).json({ error: "Từ khóa quá dài." });
        }

        const safeSearchQuery = escapeStringRegexp(searchQuery);

        const users = await User.find({
            username: { $regex: safeSearchQuery, $options: "i" },
        })
            .select("_id username avatar email")
            .limit(20).lean();

        const usersObj = await Promise.all(
          users.map(async (u) => {
            try {
              const tfb = await FriendRequest.findOne({ 
                $or: [
                  { requester: userId, target: u._id },
                  { requester: u._id, target: userId }
                ] 
              }).lean();

              return {
                ...u,
                reqFriend: tfb ? {
                  ...tfb,
                  isYouRequest: tfb?.requester.toString() === userId.toString()
                } : null,
                isYou: u._id.toString() === userId.toString()
              }
            } catch (error) {
              console.error(`Error checking friend request for :`, error);
            }
            return null;
          })
        );

        res.json(usersObj);
    } catch (error) {
        console.error("Lỗi khi truy vấn dữ liệu:", error);
        res.status(500).send("Lỗi khi truy vấn dữ liệu");
    }
});

router.post("/friends/unrequests", auth, async (req, res) => {
  try {
      const id = req.body.targetId;
      const rq = await FriendRequest.findOne(
        {
          $or: [{ _id: id, requester: req.user._id },
          { _id: id, target: req.user._id }]
        });
      if(!rq) {
        return res.status(404).json({ message: "Không tìm thấy !" });
      }
      const deletedUser = await FriendRequest.findByIdAndDelete(id);

      if (!deletedUser) {
          return res.status(404).json({ message: "Không tìm thấy !" });
      }

      res.json({ message: "Xóa thành công!", deletedUser });
  } catch (error) {
      console.log(error)
      res.status(500).json({ message: "Lỗi server", error });
  }
});

router.use("/rooms", require("./api/rooms"));
router.use("/messages", require("./api/messages"));

router.use(auth);
router.get("/", rbac("user:read"), list);
router.get("/:id", rbac("user:read"), get);
module.exports = router;
