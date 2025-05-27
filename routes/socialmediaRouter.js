const express = require('express');
const passport = require('passport');
const router = express.Router();
const { login } = require("../controllers/authController");
const User = require('../models/User');

// Đăng nhập bằng Facebook
router.get('/auth/facebook', passport.authenticate('facebook'));
router.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/profile',
    failureRedirect: '/'
}));

// Đăng nhập bằng Google
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/' }),
  async (req, res) => {

    const { username, password } = req.user;
    
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

    return res.redirect("/viewer/dashboard");
  }
);

// Đăng nhập bằng Twitter
router.get('/auth/twitter', passport.authenticate('twitter'));
router.get('/auth/twitter/callback', passport.authenticate('twitter', {
    successRedirect: '/profile',
    failureRedirect: '/'
}));

// Trang hồ sơ sau khi đăng nhập thành công
router.get('/profile', (req, res) => {
    if (!req.user) {
        return res.redirect('/');
    }
    res.send(`Chào ${req.user.displayName}`);
});

module.exports = router;
