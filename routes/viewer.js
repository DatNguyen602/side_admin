// routes/admin.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
require("dotenv").config(); // Import dotenv

// Models
const User = require("../models/User");
const Agency = require("../models/Agency");
const Branch = require("../models/Branch");
const Key = require("../models/Key");
const Session = require("../models/Session");

// --- DASHBOARD ---
router.get("/dashboard", auth, async (req, res) => {
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

module.exports = router;