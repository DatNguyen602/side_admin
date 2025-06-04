const express = require("express");
const User = require("../models/User"); // Import model User
const { sendVerificationEmail, sendEmail } = require("../utils/mailer"); // Hàm gửi email
const auth = require("../middleware/auth");

const router = express.Router();

// 📝 Hiển thị form gửi email
router.get("/send-email", auth, async (req, res) => {
    const users = await User.find({}, "username email"); // Lấy danh sách user
    try {
        res.render("utils/send-email", {
            users,
            title: "Email",
            user: req.user,
            errors: null,
            alert:  null,
        }); // Render form EJS
    } catch (error) {
        res.render("utils/send-email", {
            users: users,
            title: "Email",
            user: req.user,
            errors: null,
            alert:  null,
        });
    }
});

// ✉️ Xử lý gửi email
router.post("/send-email", auth, async (req, res) => {
    const users = await User.find({}, "username email"); // Lấy danh sách user
    try {
        const email = req.body.email || req.body.customEmail; // Lấy email từ select hoặc input
        if (!email) return res.status(400).send("Email không hợp lệ!");

        await sendEmail(email, req.body.emailSubject, req.body.emailContent);
        res.render("utils/send-email", {
            users: users,
            title: "Email",
            user: req.user,
            errors: null,
            alert: `Email đã gửi thành công đến ${email}`,
        }); // Render form EJS
    } catch (error) {
        res.render("utils/send-email", {
            users: users,
            title: "Email",
            user: req.user,
            errors: "Lỗi gửi email.",
            alert:  null,
        });
    }
});

let storedVerificationCodes = {};

router.post("/send-verification", async (req, res) => {
    const { email } = req.body;
    const code = await sendVerificationEmail(email);
    storedVerificationCodes[email] = code;
    res.send("Mã xác minh đã được gửi!");
});

router.post("/verify-email", async (req, res) => {
    const { email, verificationCode } = req.body;
    if (storedVerificationCodes[email] !== verificationCode) {
        return res.status(400).send("Mã xác minh không đúng!");
    }
    res.send("Xác minh thành công! Bạn có thể đăng ký.");
});

module.exports = router;
