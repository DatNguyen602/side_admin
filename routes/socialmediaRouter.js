const express = require('express');
const passport = require('passport');
const router = express.Router();

// Đăng nhập bằng Facebook
router.get('/auth/facebook', passport.authenticate('facebook'));
router.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/profile',
    failureRedirect: '/'
}));

// Đăng nhập bằng Google
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', {
    successRedirect: '/profile',
    failureRedirect: '/'
}));

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
