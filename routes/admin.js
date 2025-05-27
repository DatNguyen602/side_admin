// routes/admin.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const rbac = require("../middleware/rbac");
const { register } = require("../controllers/authController");
const Session = require("../models/Session");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config(); // Import dotenv

// Models
const User = require("../models/User");
const Role = require("../models/Role");
const Agency = require("../models/Agency");
const Branch = require("../models/Branch");
const Key = require("../models/Key");

// --- DASHBOARD ---
router.get("/dashboard", auth, rbac("dashboard:view"), async (req, res) => {
    const [userCount, agencyCount, branchCount, keyCount, sessions] =
        await Promise.all([
            User.countDocuments(),
            Agency.countDocuments(),
            Branch.countDocuments(),
            Key.countDocuments({ status: "issued" }),
            Session.find()
                .populate("user", "username email")
                .populate("key", "token status")
                .sort({ startedAt: -1 })
                .limit(20), // Giới hạn số bản ghi để không quá nặng
        ]);

    res.render("dashboard", {
        title: "Dashboard",
        stats: { userCount, agencyCount, branchCount, keyCount },
        user: req.user,
        sessions, // thêm dữ liệu session vào
    });
});

// --- USERS CRUD UI ---
// List users
router.get("/users", auth, rbac("user:read"), async (req, res) => {
    const users = await User.find().populate("role agency");
    res.render("users/list", {
        title: "Users",
        users,
        user: req.user,
        searchQuery: "",
    });
});

router.post("/users", auth, rbac("user:read"), async (req, res) => {
    try {
        const searchQuery = req.body.q; // Lấy từ khóa tìm kiếm từ query string
        console.log(req.body);
        const filter = searchQuery
            ? { username: { $regex: searchQuery, $options: "i" } } // Nếu có từ khóa, lọc theo name
            : {}; // Nếu không có từ khóa, lấy tất cả users

        const users = await User.find(filter).populate("role agency");

        res.render("users/list", {
            title: "Users",
            users,
            user: req.user,
            searchQuery: searchQuery || "", // Giữ giá trị tìm kiếm trên UI
        });
    } catch (error) {
        res.status(500).send("Lỗi khi truy vấn dữ liệu");
    }
});

// Show create form
router.get("/users/new", auth, rbac("user:create"), async (req, res) => {
    const roles = await Role.find();
    const agencies = await Agency.find();
    res.render("users/form", {
        title: "Tạo User mới",
        user: req.user,
        userData: {},
        roles,
        agencies,
        errors: null,
    });
});

// Handle create
router.post("/users/new", auth, rbac("user:create"), async (req, res) => {
    try {
        const fakeRes = {
            json(obj) {
                this.data = obj;
            },
            status(code) {
                this.statusCode = code;
                return this;
            },
        };
        console.log(fakeRes);
        await register({ body: req.body }, fakeRes);

        if (fakeRes.statusCode >= 400) {
            // nếu lỗi cần render lại form cùng agencies
            const agencies = await Agency.find().sort("name");
            return res.render("register", {
                title: "Tạo tài khoản",
                error: fakeRes.data.error,
                query: req.query,
                agencies,
            });
        }

        res.redirect("/admin/users");
    } catch (err) {
        console.log(err);
        const roles = await Role.find();
        const agencies = await Agency.find();
        res.render("users/form", {
            title: "Tạo User mới",
            user: req.user,
            userData: req.body,
            roles,
            agencies,
            errors: err.errors
                ? Object.values(err.errors)
                      .map((e) => e.message)
                      .join(", ")
                : err.message,
        });
    }
});

const multer = require("multer");
const xlsx = require("xlsx");
const upload = multer({ dest: "uploads/" });

router.post(
    "/users/import",
    auth,
    upload.single("excelFile"),
    async (req, res) => {
        try {
            const allowedTypes = [".xlsx", ".xls", ".csv"];
            console.log(req.file.originalname);
            const ext = path.extname(req.file.originalname).toLowerCase();
            if (!allowedTypes.includes(ext)) {
                return res
                    .status(400)
                    .send("Chỉ chấp nhận file Excel (.xlsx, .xls, .csv)");
            }

            const workbook = xlsx.readFile(req.file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(sheet);

            const usersToInsert = await Promise.all(
                data.map(async (row) => {
                    const role = await Role.findOne({ name: row.role });
                    const agency = await Agency.findOne({ name: row.agency });

                    return {
                        username: row.username,
                        email: row.email,
                        password: row.password, // sẽ hash trong model
                        role: role?._id,
                        agency: agency?._id,
                    };
                })
            );

            await User.insertMany(usersToInsert);

            res.redirect("/admin/users");
        } catch (err) {
            console.error("Import error:", err);
            res.status(500).send("Đã xảy ra lỗi khi import users");
        }
    }
);

router.get("/users/manual-bulk", auth, async (req, res) => {
    const roles = await Role.find();
    const agencies = await Agency.find();
    res.render("users/bulk", {
        title: "Tạo nhiều user",
        user: req.user,
        roles,
        agencies,
        errors: null,
        success: null,
    });
});

router.post("/users/manual-bulk", auth, async (req, res) => {
    const roles = await Role.find();
    const agencies = await Agency.find();
    const users = {
        username: req.body.username || [],
        email: req.body.email || [],
        password: req.body.password || [],
        role: req.body.role || [],
        agency: req.body.agency || [],
    };
    const username = req.body.username || [];
    const email = req.body.email || [];
    const password = req.body.password || [];
    const role = req.body.role || [];
    const agency = req.body.agency || [];

    const success = [];
    const errors = [];

    for (let i = 0; i < username.length; i++) {
        try {
            const exists = await User.findOne({
                $or: [{ username: username[i] }, { email: email[i] }],
            });
            if (exists) {
                errors.push(`Dòng ${i + 1}: Username hoặc Email đã tồn tại`);
                continue;
            }

            const newUser = new User({
                username: username[i],
                email: email[i],
                password: password[i],
                role: role[i],
                agency: agency[i],
            });

            await newUser.save();
            success.push(`Đã đăng ký thành công: ${username[i]}`);
        } catch (err) {
            errors.push(`Dòng ${i + 1}: Lỗi không xác định`);
        }
    }

    res.render("users/bulk", {
        title: "Tạo nhiều user",
        user: req.user,
        roles,
        agencies,
        errors: errors,
        success: success,
    });
});

// Show edit form
router.get("/users/:id/edit", auth, rbac("user:update"), async (req, res) => {
    const u = await User.findById(req.params.id);
    const roles = await Role.find();
    const agencies = await Agency.find();
    res.render("users/form", {
        title: "Chỉnh sửa User",
        user: req.user,
        userData: u,
        roles,
        agencies,
        errors: null,
    });
});

// Handle update
router.post("/users/:id/edit", auth, rbac("user:update"), async (req, res) => {
    console.log(req.params);
    console.log(req.body);
    try {
        await User.findByIdAndUpdate(req.params.id, req.body);
        res.redirect("/admin/users");
    } catch (err) {
        const roles = await Role.find();
        const agencies = await Agency.find();
        res.render("users/form", {
            title: "Chỉnh sửa User",
            user: req.user,
            userData: { ...req.body, _id: req.params.id },
            roles,
            agencies,
            errors: err.message,
        });
    }
});

// Handle delete
router.post(
    "/users/:id/delete",
    auth,
    rbac("user:delete"),
    async (req, res) => {
        await User.findByIdAndDelete(req.params.id);
        res.redirect("/admin/users");
    }
);

// --- AGENCIES CRUD UI ---
// List
router.get("/agencies", auth, rbac("agency:read"), async (req, res) => {
    const agencies = await Agency.find();
    res.render("agencies/list", {
        title: "Agencies",
        agencies,
        user: req.user,
    });
});

// Create form
router.get("/agencies/new", auth, rbac("agency:create"), (req, res) => {
    res.render("agencies/form", {
        title: "Tạo Agency",
        agency: {},
        user: req.user,
        errors: null,
    });
});

// Handle create
router.post("/agencies/new", auth, rbac("agency:create"), async (req, res) => {
    try {
        await Agency.create(req.body);
        res.redirect("/admin/agencies");
    } catch (err) {
        res.render("agencies/form", {
            title: "Tạo Agency",
            agency: req.body,
            user: req.user,
            errors: err.message,
        });
    }
});

// Edit form
router.get(
    "/agencies/:id/edit",
    auth,
    rbac("agency:update"),
    async (req, res) => {
        const a = await Agency.findById(req.params.id);
        res.render("agencies/form", {
            title: "Chỉnh sửa Agency",
            agency: a,
            user: req.user,
            errors: null,
        });
    }
);

// Handle update
router.post(
    "/agencies/:id/edit",
    auth,
    rbac("agency:update"),
    async (req, res) => {
        try {
            await Agency.findByIdAndUpdate(req.params.id, req.body);
            res.redirect("/admin/agencies");
        } catch (err) {
            res.render("agencies/form", {
                title: "Chỉnh sửa Agency",
                agency: { ...req.body, _id: req.params.id },
                user: req.user,
                errors: err.message,
            });
        }
    }
);

// Delete
router.post(
    "/agencies/:id/delete",
    auth,
    rbac("agency:delete"),
    async (req, res) => {
        await Agency.findByIdAndDelete(req.params.id);
        res.redirect("/admin/agencies");
    }
);

// --- BRANCHES CRUD UI ---
// List
router.get("/branches", auth, rbac("branch:read"), async (req, res) => {
    const branches = await Branch.find().populate("agency");
    res.render("branches/list", {
        title: "Branches",
        branches,
        user: req.user,
    });
});

// Create form
router.get("/branches/new", auth, rbac("branch:create"), async (req, res) => {
    const agencies = await Agency.find();
    res.render("branches/form", {
        title: "Tạo Branch",
        branch: {},
        agencies,
        user: req.user,
        errors: null,
    });
});

// Handle create
router.post("/branches/new", auth, rbac("branch:create"), async (req, res) => {
    try {
        await Branch.create(req.body);
        res.redirect("/admin/branches");
    } catch (err) {
        const agencies = await Agency.find();
        res.render("branches/form", {
            title: "Tạo Branch",
            branch: req.body,
            agencies,
            user: req.user,
            errors: err.message,
        });
    }
});

// Edit form
router.get(
    "/branches/:id/edit",
    auth,
    rbac("branch:update"),
    async (req, res) => {
        const b = await Branch.findById(req.params.id);
        const agencies = await Agency.find();
        res.render("branches/form", {
            title: "Chỉnh sửa Branch",
            branch: b,
            agencies,
            user: req.user,
            errors: null,
        });
    }
);

// Handle update
router.post(
    "/branches/:id/edit",
    auth,
    rbac("branch:update"),
    async (req, res) => {
        try {
            await Branch.findByIdAndUpdate(req.params.id, req.body);
            res.redirect("/admin/branches");
        } catch (err) {
            const agencies = await Agency.find();
            res.render("branches/form", {
                title: "Chỉnh sửa Branch",
                branch: { ...req.body, _id: req.params.id },
                agencies,
                user: req.user,
                errors: err.message,
            });
        }
    }
);

// Delete
router.post(
    "/branches/:id/delete",
    auth,
    rbac("branch:delete"),
    async (req, res) => {
        await Branch.findByIdAndDelete(req.params.id);
        res.redirect("/admin/branches");
    }
);

// --- KEYS CRUD UI ---
// List
router.get("/keys", auth, rbac("key:read"), async (req, res) => {
    const keys = await Key.find().populate({
        path: "branch",
        populate: "agency",
    });
    res.render("keys/list", { title: "Keys", keys, user: req.user });
});

// Create form
router.get("/keys/new", auth, rbac("key:create"), async (req, res) => {
    const branches = await Branch.find().populate("agency");
    const users = await User.find();
    res.render("keys/form", {
        title: "Tạo Key",
        keyData: {},
        branches,
        user: req.user,
        users: users ?? [],
        errors: null,
    });
});

// Handle create
router.post("/keys/new", auth, rbac("key:create"), async (req, res) => {
    try {
        const { branchId, userIds, dateStartUse, dateEndUse } = req.body;
        // Chuyển đổi ngày để kiểm tra
        const today = new Date().setHours(0, 0, 0, 0);
        const startDate = new Date(dateStartUse).setHours(0, 0, 0, 0);
        const endDate = new Date(dateEndUse).setHours(0, 0, 0, 0);

        if (startDate < today || endDate < today) {
            return res.status(400).json({
                message: "Ngày bắt đầu và kết thúc phải từ hôm nay trở đi.",
            });
        }

        if (endDate <= startDate) {
            return res.status(400).json({
                message: "Ngày kết thúc không thể nhỏ hơn ngày bắt đầu.",
            });
        }
        // userIds có thể là string hoặc mảng
        const normalizedUserIds = Array.isArray(userIds)
            ? userIds
            : userIds
            ? [userIds]
            : [];
        const token = require("crypto").randomBytes(16).toString("hex");
        await Key.create({
            token,
            branch: branchId,
            userIds: normalizedUserIds,
            dateStartUse: dateStartUse,
            dateEndUse: dateEndUse,
        });
        res.redirect("/admin/keys");
    } catch (err) {
        const branches = await Branch.find().populate("agency");
        res.render("keys/form", {
            title: "Tạo Key",
            keyData: req.body,
            branches,
            user: req.user,
            errors: err.message,
        });
    }
});

// GET edit page
router.get("/keys/:id/edit", auth, rbac("key:update"), async (req, res) => {
    const key = await Key.findById(req.params.id).populate("branch").lean();
    const branches = await Branch.find().populate("agency").lean();
    const users = await User.find().populate("agency").lean();
    res.render("keys/edit", {
        title: "Chỉnh sửa Key",
        errors: null,
        key,
        branches,
        users,
    });
});

// POST update
router.post("/keys/:id/edit", auth, rbac("key:update"), async (req, res) => {
    const { branchId, dateStartUse, dateEndUse, userIds, status } = req.body;

    try {
        await Key.findByIdAndUpdate(req.params.id, {
            branch: branchId,
            dateStartUse,
            dateEndUse,
            status,
            userIds: Array.isArray(userIds) ? userIds : userIds ? [userIds] : [],
        });
        res.redirect("/admin/keys");
    } catch (err) {
        res.render("keys/edit", {
            title: "Chỉnh sửa Key",
            errors: "Có lỗi xảy ra khi cập nhật key.",
            key: await Key.findById(req.params.id).lean(),
            branches: await Branch.find().populate("agency").lean(),
            users: await User.find().populate("agency").lean(),
        });
    }
});

// Delete
router.post("/keys/:id/delete", auth, rbac("key:delete"), async (req, res) => {
    await Key.findByIdAndDelete(req.params.id);
    res.redirect("/admin/keys");
});

// List role
router.get("/roles", auth, async (req, res) => {
    const roles = await Role.find({ $and: [{ name: { $ne: "admin" } }, { name: { $ne: "viewer" } }] });
    res.render("roles/list", {
        title: "Roles",
        roles,
        user: req.user,
    });
});

// Lấy danh sách các models (ngoại trừ Role)
const getModels = () => {
    return [
        "dashboard",
        ...Object.keys(mongoose.models)
            .filter((model) => model !== "Role")
            .map((x) => x.toLowerCase()),
    ];
};

const permissions = process.env.PERMISSIONS
    ? process.env.PERMISSIONS.split(",")
    : [];

// Route hiển thị danh sách quyền theo Role
router.get("/roles/:id/view", auth, async (req, res) => {
    const roles = await Role.find();
    const role = await Role.findById(req.params.id);
    const models = getModels();

    res.render("roles/view", {
        title: "Roles",
        errors: null,
        roles,
        role,
        models,
        permissions,
        user: req.user,
    });
});

router.get("/roles/new", async (req, res) => {
    const models = getModels(); // Lấy danh sách các models có trong DB
    res.render("roles/create", { title: "Tạo Role Mới", models, permissions });
});

// Tạo mới Role
router.post("/roles/create", auth, async (req, res) => {
    const { name, permissions } = req.body;
    const role = await Role.findOne({name: name});
    if(!role) {
        const newRole = new Role({ name, permissions: permissions });
        await newRole.save();
    }
    res.redirect("/admin/roles");
});

router.get("/roles/:id/edit", auth, async (req, res) => {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).send("Role không tồn tại");

    const models = getModels();

    res.render("roles/edit", {
        title: `Chỉnh Sửa Role ${role.name}`,
        role,
        models,
        permissions,
    });
});

// Chỉnh sửa Role
router.post("/roles/:id/edit", auth, async (req, res) => {
    const { name, permissions } = req.body;

    await Role.findByIdAndUpdate(req.params.id, {
        name,
        permissions: permissions ?? [],
    });
    res.redirect(`/admin/roles/${req.params.id}/view`);
});

// Delete
router.post("/roles/:id/delete", auth, async (req, res) => {
    await Role.findByIdAndDelete(req.params.id);
    res.redirect("/admin/roles");
});

module.exports = router;
