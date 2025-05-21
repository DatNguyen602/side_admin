// routes/admin.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const rbac = require("../middleware/rbac");
const { register } = require("../controllers/authController");

// Models
const User = require("../models/User");
const Role = require("../models/Role");
const Agency = require("../models/Agency");
const Branch = require("../models/Branch");
const Key = require("../models/Key");

// --- DASHBOARD ---
router.get("/dashboard", auth, rbac("dashboard:view"), async (req, res) => {
    const [userCount, agencyCount, branchCount, keyCount] = await Promise.all([
        User.countDocuments(),
        Agency.countDocuments(),
        Branch.countDocuments(),
        Key.countDocuments({ status: "issued" }),
    ]);
    res.render("dashboard", {
        title: "Dashboard",
        stats: { userCount, agencyCount, branchCount, keyCount },
        user: req.user,
    });
});

// --- USERS CRUD UI ---
// List users
router.get("/users", auth, rbac("users:read"), async (req, res) => {
    const users = await User.find().populate("role agency");
    res.render("users/list", {
        title: "Users",
        users,
        user: req.user,
    });
});

// Show create form
router.get("/users/new", auth, rbac("users:create"), async (req, res) => {
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
router.post("/users/new", auth, rbac("users:create"), async (req, res) => {
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

// Show edit form
router.get("/users/:id/edit", auth, rbac("users:update"), async (req, res) => {
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
router.post("/users/:id/edit", auth, rbac("users:update"), async (req, res) => {
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
    rbac("users:delete"),
    async (req, res) => {
        await User.findByIdAndDelete(req.params.id);
        res.redirect("/admin/users");
    }
);

// --- AGENCIES CRUD UI ---
// List
router.get("/agencies", auth, rbac("agencies:read"), async (req, res) => {
    const agencies = await Agency.find();
    res.render("agencies/list", {
        title: "Agencies",
        agencies,
        user: req.user,
    });
});

// Create form
router.get("/agencies/new", auth, rbac("agencies:create"), (req, res) => {
    res.render("agencies/form", {
        title: "Tạo Agency",
        agency: {},
        user: req.user,
        errors: null,
    });
});

// Handle create
router.post(
    "/agencies/new",
    auth,
    rbac("agencies:create"),
    async (req, res) => {
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
    }
);

// Edit form
router.get(
    "/agencies/:id/edit",
    auth,
    rbac("agencies:update"),
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
    rbac("agencies:update"),
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
    rbac("agencies:delete"),
    async (req, res) => {
        await Agency.findByIdAndDelete(req.params.id);
        res.redirect("/admin/agencies");
    }
);

// --- BRANCHES CRUD UI ---
// List
router.get("/branches", auth, rbac("branches:read"), async (req, res) => {
    const branches = await Branch.find().populate("agency");
    res.render("branches/list", {
        title: "Branches",
        branches,
        user: req.user,
    });
});

// Create form
router.get("/branches/new", auth, rbac("branches:create"), async (req, res) => {
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
router.post(
    "/branches/new",
    auth,
    rbac("branches:create"),
    async (req, res) => {
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
    }
);

// Edit form
router.get(
    "/branches/:id/edit",
    auth,
    rbac("branches:update"),
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
    rbac("branches:update"),
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
    rbac("branches:delete"),
    async (req, res) => {
        await Branch.findByIdAndDelete(req.params.id);
        res.redirect("/admin/branches");
    }
);

// --- KEYS CRUD UI ---
// List
router.get("/keys", auth, rbac("keys:read"), async (req, res) => {
    const keys = await Key.find().populate({
        path: "branch",
        populate: "agency",
    });
    res.render("keys/list", { title: "Keys", keys, user: req.user });
});

// Create form
router.get("/keys/new", auth, rbac("keys:create"), async (req, res) => {
    const branches = await Branch.find().populate("agency");
    res.render("keys/form", {
        title: "Tạo Key",
        keyData: {},
        branches,
        user: req.user,
        errors: null,
    });
});

// Handle create
router.post("/keys/new", auth, rbac("keys:create"), async (req, res) => {
    try {
        const token = require("crypto").randomBytes(16).toString("hex");
        await Key.create({ token, branch: req.body.branchId });
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

// Delete
router.post("/keys/:id/delete", auth, rbac("keys:delete"), async (req, res) => {
    await Key.findByIdAndDelete(req.params.id);
    res.redirect("/admin/keys");
});

module.exports = router;
