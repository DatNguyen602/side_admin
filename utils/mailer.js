const nodemailer = require('nodemailer');
const { google } = require('googleapis');
require('dotenv').config();

// Các biến cấu hình OAuth2
const GMAIL_USER = process.env.GMAIL_USER;
const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.OAUTH_REFRESH_TOKEN;

// Khởi tạo OAuth2 Client
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// Hàm lấy access token
async function getAccessToken() {
  const accessToken = await oAuth2Client.getAccessToken();
  return accessToken.token;
}

// Hàm tạo transporter chung
async function createTransporter() {
  const accessToken = await getAccessToken();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_USER,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshToken: REFRESH_TOKEN,
      accessToken: accessToken,
    },
  });
}

// Hàm gửi email
async function sendEmail(email, subject, content) {
  try {
    const transporter = await createTransporter();
    const mailOptions = {
      from: `"Hệ thống quản lý" <${GMAIL_USER}>`,
      to: email,
      subject: subject,
      html: content,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email được gửi thành công:', info.response);
    return info;
  } catch (error) {
    console.error('❌ Lỗi khi gửi email:', error.message || error);
    throw error;
  }
}

// Hàm gửi thông báo đăng nhập
async function sendLoginNotification(email, username) {
  const now = new Date().toLocaleString('vi-VN');
  const content = `<p>Xin chào <strong>${username}</strong>,</p>
                   <p>Bạn đã đăng nhập vào hệ thống lúc: <strong>${now}</strong></p>
                   <p>Nếu đây không phải bạn, vui lòng đổi mật khẩu ngay lập tức.</p>`;
  return sendEmail(email, 'Thông báo đăng nhập hệ thống', content);
}

// Xuất module
module.exports = { sendLoginNotification, sendEmail };
