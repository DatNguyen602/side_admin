const nodemailer = require('nodemailer');
const { google } = require('googleapis');
require('dotenv').config();

// Các biến cấu hình OAuth2 – bạn nên đặt trong file .env
const GMAIL_USER = process.env.GMAIL_USER || 'hhay4317@gmail.com';
const CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REFRESH_TOKEN = process.env.OAUTH_REFRESH_TOKEN || 'YOUR_REFRESH_TOKEN';

// Khởi tạo OAuth2 Client
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

/**
 * Gửi email thông báo đăng nhập sử dụng OAuth2 của Gmail trong Node.js.
 * @param {string} email Email đích nhận thông báo.
 * @param {string} username Tên người dùng đăng nhập.
 * @returns {Promise<any>} Kết quả gửi email.
 */
async function sendLoginNotification(email, username) {
  try {
    // Lấy access token động
    const accessToken = await oAuth2Client.getAccessToken();

    // Tạo transporter với OAuth2
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: GMAIL_USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token, // <-- accessToken.token là dạng chuẩn
      },
    });

    // Lấy thời gian hiện tại theo định dạng của Việt Nam
    const now = new Date().toLocaleString('vi-VN');

    const mailOptions = {
      from: `"Hệ thống quản lý" <${GMAIL_USER}>`,
      to: email,
      subject: 'Thông báo đăng nhập hệ thống',
      html: `<p>Xin chào <strong>${username}</strong>,</p>
             <p>Bạn đã đăng nhập vào hệ thống lúc: <strong>${now}</strong></p>
             <p>Nếu đây không phải bạn, vui lòng đổi mật khẩu ngay lập tức.</p>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email được gửi thành công:', info.response);
    return info;
  } catch (error) {
    console.error('❌ Lỗi khi gửi email:', error.message || error);
    throw error;
  }
}

module.exports = { sendLoginNotification };
