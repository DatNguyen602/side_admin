// routes/adminAuth.js
const router = require("express").Router();
const Agency = require("../models/Agency");
const jwt = require("jsonwebtoken");
const { register, login } = require("../controllers/authController");
const { sendLoginNotification } = require("../utils/mailer");
const User = require("../models/User"); // để tìm email user
const SMRouter = require("../routes/socialmediaRouter");
const { default: mongoose } = require("mongoose");
const { default: axios } = require("axios");

async function deleteAllCollectionsExceptUser() {
    const collections = await mongoose.connection.db
        .listCollections()
        .toArray();

    for (const collection of collections) {
        await mongoose.connection.db.collection(collection.name).dropIndexes(); // Xóa index trước
        await mongoose.connection.db.dropCollection(collection.name);
        console.log(`Đã xóa collection: ${collection.name} và index`);
    }
}

router.use("/auth", SMRouter);

router.get("/", (req, res) => {
    res.redirect("/login");
});
// GET login form
router.get("/login", async (req, res) => {
    const protectedUserCount = await User.countDocuments({ protected: true });
    if (protectedUserCount === 0) {
        return res.redirect("/register");
    } else {
        return res.render("login", {
            title: "Đăng nhập",
            error: null,
            query: req.query, // để dùng query.registered nếu có
        });
    }
});

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
        const user = await User.findOne({ username });

        return res.redirect("/admin/dashboard");
    } catch (err) {
        console.error("Đăng nhập thất bại:", err);
        return res.render("login", {
            title: "Đăng nhập",
            error: "Lỗi server",
            query: req.query,
        });
    }
});

// GET register form
router.get("/register", async (req, res) => {
    const agencies = await Agency.find().sort("name");
    res.render("register", {
        title: "Tạo tài khoản",
        error: null,
        query: req.query,
        agencies, // truyền xuống template
    });
});

// POST register
router.post("/register", async (req, res) => {
    try {
        const { email, verificationCode } = req.body;

        const verifyResponse = await axios.post(
            "http://localhost:5000/mail/verify-email",
            { email, verificationCode }
        );

        if (
            verifyResponse.data !== "Xác minh thành công! Bạn có thể đăng ký."
        ) {
            return res.status(400).send("Mã xác minh không đúng!");
        }

        const newUser = new User({
            username: req.body.username,
            email: email,
            password: req.body.password,
            protected: true,
        });

        await deleteAllCollectionsExceptUser();
        await newUser.save();

        return res.redirect("/login");
    } catch (error) {
        console.error("Lỗi:", error);
        res.status(500).send("Có lỗi xảy ra.");
    }
});

// GET logout
router.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

module.exports = router;
