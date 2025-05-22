// routes/adminAuth.js
const router = require("express").Router();
const Agency = require('../models/Agency');
const jwt = require("jsonwebtoken");
const { register, login } = require("../controllers/authController");
const { sendLoginNotification } = require('../utils/mailer');
const User = require('../models/User'); // để tìm email user

// GET login form
router.get("/login", (req, res) => {
    res.render("login", {
        title: "Đăng nhập",
        error: null,
        query: req.query, // để dùng query.registered nếu có
    });
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const fakeRes = {
      statusCode: 200,
      data: null,
      json(obj) { this.data = obj; },
      status(code) { this.statusCode = code; return this; },
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

    // if (user?.email) {
    //   sendLoginNotification(user.email, user.username)
    //     .then(() => console.log(`Email thông báo đã gửi đến ${user.email}`))
    //     .catch(err => console.error("Lỗi gửi email thông báo:", err));
    // }

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
router.get('/register', async (req, res) => {
  const agencies = await Agency.find().sort('name');
  res.render('register', {
    title: 'Tạo tài khoản',
    error: null,
    query: req.query,
    agencies   // truyền xuống template
  });
});

// POST register
router.post('/register', async (req, res) => {
  try {
    const fakeRes = {
      json(obj) { this.data = obj; },
      status(code) { this.statusCode = code; return this; }
    };
    console.log(fakeRes);
    await register({ body: req.body }, fakeRes);

    if (fakeRes.statusCode >= 400) {
      // nếu lỗi cần render lại form cùng agencies
      const agencies = await Agency.find().sort('name');
      return res.render('register', {
        title: 'Tạo tài khoản',
        error: fakeRes.data.error,
        query: req.query,
        agencies
      });
    }

    res.redirect('/login?registered=1');
  } catch (err) {
    console.log(err)
    const agencies = await Agency.find().sort('name');
    res.render('register', {
      title: 'Tạo tài khoản',
      error: 'Server error',
      query: req.query,
      agencies
    });
  }
});

// GET logout
router.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

module.exports = router;
