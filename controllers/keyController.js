const Key = require("../models/Key");
const Session = require("../models/Session");
const Agency = require("../models/Agency");
const Branch = require("../models/Branch");
const User = require("../models/User");
const bcrypt = require("bcrypt");

exports.list = (req, res) =>
    Key.find()
        .populate({ path: "branch", populate: "agency" })
        .then((keys) => res.json(keys));

exports.verify = async (req, res) => {
    const key = await Key.findOne({ token: req.params.token });
    if (!key) return res.json({ exists: false });
    const branch = await Branch.findById(key.branch);
    const agency = await Agency.findById(branch.agency);
    res.json({ 
        exists: true, 
        key: {
            token: key.token,
            dateStartUse: key.dateStartUse,
            dateEndUse: key.dateEndUse,
            status: key.status, 
            branch: {
                agency: agency.name,
                branch: branch.name,
                location: branch.location,
                description: agency.description
            }
        } 
    });
};

exports.loginAndCreateSession = async (req, res) => {
    const { username, password, token } = req.body;

    const user = await User.findOne({ username });
    if (!user)
        return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
        return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });

    const key = await Key.findOne({ token });
    if (!key) return res.status(404).json({ message: "Key không tồn tại" });

    // Kiểm tra trạng thái
    if (key.status === "revoked")
        return res.status(403).json({ message: "Key đã bị thu hồi" });
    if (key.status === "used")
        return res.status(500).json({ message: "Key đang được sử dụng!" });

    // Kiểm tra quyền người dùng nếu có ràng buộc
    if (key.userIds.length > 0) {
        const isAllowed = key.userIds.some(
            (uid) => uid.toString() === user._id.toString()
        );
        if (!isAllowed)
            return res
                .status(403)
                .json({ message: "Bạn không được phép sử dụng key này" });
    }

    // Kiểm tra thời gian hiệu lực
    const now = new Date();
    if (now < key.dateStartUse)
        return res
            .status(403)
            .json({ message: "Key chưa đến thời gian sử dụng" });
    if (now > key.dateEndUse)
        return res.status(403).json({ message: "Key đã hết hạn sử dụng" });

    // Cập nhật trạng thái key
    key.status = "used";
    await key.save();

    const branch = await Branch.findById(key.branch);
    const agency = await Agency.findById(branch.agency);
    const session = await Session.create({ user: user._id, key: key._id });

    res.json({
        message: "Đăng nhập và tạo phiên thành công",
        session,
        user: { username: user.username, email: user.email },
        infor: {
            token: key.token,
            dateStartUse: key.dateStartUse,
            dateEndUse: key.dateEndUse,
            status: key.status, 
            branch: {
                agency: agency.name,
                branch: branch.name,
                location: branch.location,
                description: agency.description
            }
        }
    });
};

// Tạo phiên làm việc mới
exports.createSession = async (req, res) => {
    const { token, userId } = req.body;

    const key = await Key.findOne({ token });
    if (!key) return res.status(404).json({ message: "Key không tồn tại" });

    if (key.status === "revoked")
        return res.status(403).json({ message: "Key đã bị thu hồi" });
    if (key.status === "used")
        return res.status(500).json({ message: "Key đang được sử dụng!" });

    // Kiểm tra user được phép sử dụng
    if (key.userIds.length > 0 && !key.userIds.includes(userId)) {
        return res
            .status(403)
            .json({ message: "Người dùng không được phép sử dụng key này" });
    }

    // Kiểm tra ngày sử dụng
    const now = new Date();
    if (now < key.dateStartUse)
        return res
            .status(403)
            .json({ message: "Key chưa đến thời gian sử dụng" });
    if (now > key.dateEndUse)
        return res.status(403).json({ message: "Key đã hết hạn sử dụng" });

    // Cập nhật trạng thái key
    key.status = "used";
    await key.save();

    const branch = await Branch.findById(key.branch);
    const agency = await Agency.findById(branch.agency);
    const session = await Session.create({ user: userId, key: key._id });

    res.json({
        message: "Phiên làm việc đã được tạo",
        session,
        infor: {
            token: key.token,
            dateStartUse: key.dateStartUse,
            dateEndUse: key.dateEndUse,
            status: key.status, 
            branch: {
                agency: agency.name,
                branch: branch.name,
                location: branch.location,
                description: agency.description
            }
        }
    });
};

// Hủy phiên làm việc
exports.cancelSession = async (req, res) => {
    const { token, userId } = req.body;

    const key = await Key.findOne({ token });
    if (!key) return res.status(404).json({ message: "Key không tồn tại" });

    if (key.status === "used") {
        key.status = "issued";
        await key.save();
    }

    // Tìm phiên làm việc chưa kết thúc
    const session = await Session.findOne({
        user: userId,
        key: key._id,
        endedAt: null,
    });
    if (!session)
        return res
            .status(404)
            .json({ message: "Phiên làm việc không tồn tại hoặc đã hủy" });

    // Kết thúc phiên làm việc
    session.endedAt = new Date();
    await session.save();

    // Không thay đổi trạng thái key (giữ nguyên trạng thái)
    // Nếu muốn thu hồi key khi hủy session, uncomment dòng dưới
    // key.status = 'revoked'; await key.save();

    res.json({ message: "Phiên làm việc đã được hủy" });
};

exports.loginAndCancelSession = async (req, res) => {
    const { username, password, token } = req.body;

    // 1. Tìm user theo username hoặc email
    const user = await User.findOne({
        $or: [{ username }, { email: username }],
    });
    if (!user)
        return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });

    // 2. So sánh mật khẩu
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
        return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });

    // 3. Tìm key
    const key = await Key.findOne({ token });
    if (!key) return res.status(404).json({ message: "Key không tồn tại" });

    // 4. Tìm session chưa kết thúc với user và key
    const session = await Session.findOne({
        user: user._id,
        key: key._id,
        endedAt: null,
    });

    if (!session)
        return res
            .status(404)
            .json({ message: "Không tìm thấy phiên làm việc đang hoạt động" });

    // 5. Kết thúc session
    session.endedAt = new Date();
    await session.save();

    // 6. Cập nhật trạng thái key (quay lại trạng thái 'issued')
    key.status = "issued";
    await key.save();

    res.json({ message: "Phiên làm việc đã được hủy" });
};

exports.update = async (req, res) => {
    await Key.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: "Key updated" });
};

exports.remove = async (req, res) => {
    await Key.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
};

exports.listSessions = async (req, res) => {
    // Lấy tất cả session, populate thông tin user và key
    const sessions = await Session.find()
        .populate("user", "username email")
        .populate("key", "token status")
        .sort({ startedAt: -1 });

    res.json(sessions);
};
