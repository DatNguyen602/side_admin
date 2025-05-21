// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');

module.exports = async (req, res, next) => {
  try {
    // 1) Lấy token từ cookie hoặc header
    const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return res.redirect('/login');

    // 2) Verify
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Load user & role.permissions
    const user = await User.findById(payload.id).populate('role');
    if (!user) {
      res.clearCookie('token');
      return res.redirect('/login');
    }

    // 4) Gán req.user và res.locals.user để templates có thể dùng
    req.user = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role.name,
      permissions: user.role.permissions,  // array of strings
    };
    res.locals.user = req.user;

    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
};
