const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hhay4317@gmail.com',
    pass: 'Nxdat0782798121@', // App password nếu dùng Gmail
  },
});

async function sendLoginNotification(email, username) {
  const now = new Date().toLocaleString('vi-VN');
  const info = await transporter.sendMail({
    from: '"Hệ thống quản lý" <hhay4317@gmail.com>',
    to: email,
    subject: 'Thông báo đăng nhập hệ thống',
    html: `<p>Xin chào <strong>${username}</strong>,</p>
           <p>Bạn đã đăng nhập vào hệ thống lúc: <strong>${now}</strong></p>
           <p>Nếu đây không phải bạn, vui lòng đổi mật khẩu ngay lập tức.</p>`,
  });
  return info;
}

module.exports = { sendLoginNotification };
