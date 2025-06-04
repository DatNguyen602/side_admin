const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const crypto = require('crypto');
require('dotenv').config();

// === OAuth2 config ===
const GMAIL_USER       = process.env.GMAIL_USER;
const CLIENT_ID        = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET    = process.env.OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN    = process.env.OAUTH_REFRESH_TOKEN;

if (!GMAIL_USER || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('❌ Thiếu biến môi trường cho OAuth2 (GMAIL_USER, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)');
  process.exit(1);
}

// === Tạo OAuth2 client và set credentials ===
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// === Lấy Access Token (và tự động refresh khi cần) ===
async function getAccessToken() {
  try {
    const { token } = await oAuth2Client.getAccessToken();
    return token;
  } catch (err) {
    console.error('❌ Lỗi khi lấy access token:', err);
    throw err;
  }
}

// === Tạo transporter với OAuth2 ===
// Giải thích: chúng ta chỉ khởi tạo transporter một lần, còn getAccessToken() sẽ tự động cấp token mới mỗi lần gọi sendMail
let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const accessToken = await getAccessToken();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type:         'OAuth2',
      user:         GMAIL_USER,
      clientId:     CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshToken: REFRESH_TOKEN,
      accessToken, // token lần đầu; Nodemailer sẽ tự refresh khi expire
    },
    tls: {
      rejectUnauthorized: false, // trong trường hợp dev/local; production thì nên loại bỏ dòng này
    },
  });

  try {
    await transporter.verify();
    console.log('✅ SMTP server sẵn sàng gửi email!');
  } catch (err) {
    console.error('❌ Lỗi kết nối tới SMTP server:', err);
    throw err;
  }

  cachedTransporter = transporter;
  return cachedTransporter;
}

// === Hàm gốc để gửi email ===
async function sendMail({ to, subject, html, from }) {
  try {
    const transporter = await getTransporter();
    const mailOptions = {
      from:    from || `"Hệ thống quản lý" <${GMAIL_USER}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email đã gửi tới ${to}: ${info.response}`);
    return info;
  } catch (err) {
    console.error(`❌ Lỗi khi gửi email tới ${to}:`, err.message || err);
    throw err;
  }
}

// === Hàm gửi email chung (cho các mục đích tuỳ ý) ===
async function sendEmail(email, subject, content, from) {
  return sendMail({ to: email, subject, html: content, from });
}

// === Escape HTML (đơn giản) ===
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// === Hàm gửi thông báo đăng nhập ===
async function sendLoginNotification(email, username) {
  const nowString = new Date().toLocaleString('vi-VN');
  const safeUsername = escapeHtml(username);
  const content = `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 500px;
      margin: auto;
      padding: 20px;
      background-color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    ">
      <div style="text-align: center;">
        <img src="https://example.com/logo.png" alt="Logo" style="width: 80px; margin-bottom: 15px;" />
        <h2 style="color: #333; margin-bottom: 10px;">🔐 Xác nhận đăng nhập</h2>
        <p style="color: #555; font-size: 16px;">
          Xin chào <strong style="color: #007bff;">${safeUsername}</strong>,
        </p>
      </div>
      <div style="
        background-color: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-top: 10px;
      ">
        <p style="margin: 0; font-size: 16px; color: #333;">
          Bạn đã đăng nhập vào hệ thống lúc:
        </p>
        <p style="
          margin: 5px 0;
          font-size: 18px;
          font-weight: bold;
          color: #28a745;
        ">
          ${escapeHtml(nowString)}
        </p>
      </div>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
      <div style="text-align: center;">
        <p style="color: #dc3545; font-size: 16px;">
          Nếu đây không phải bạn, vui lòng đổi mật khẩu ngay lập tức!
        </p>
        <a href="https://example.com/change-password" style="
          display: inline-block;
          padding: 10px 20px;
          background-color: #dc3545;
          color: #fff;
          text-decoration: none;
          border-radius: 5px;
          font-size: 16px;
        ">
          Đổi mật khẩu
        </a>
      </div>
      <p style="
        color: #666;
        font-size: 14px;
        text-align: center;
        margin-top: 20px;
      ">
        Cảm ơn bạn đã sử dụng hệ thống của chúng tôi!
      </p>
    </div>
  `;

  return sendMail({
    to:      email,
    subject: 'Thông báo đăng nhập hệ thống',
    html:    content,
  });
}

// === Hàm gửi mã xác minh email ===
async function sendVerificationEmail(email, verificationCode) {
  // Nếu không truyền verificationCode, tự sinh ra 6 ký tự HEX
  const code = verificationCode || crypto.randomBytes(3).toString('hex').toUpperCase();

  const content = `
    <div style="
      max-width: 600px;
      margin: auto;
      padding: 20px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
    ">
      <div style="text-align: center; padding-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-bottom: 0;">Xác minh Email</h2>
        <p style="margin-top: 5px; color: #555;">Bảo vệ tài khoản của bạn</p>
      </div>
      <div style="
        background-color: #ffffff;
        padding: 20px;
        border-radius: 8px;
      ">
        <p>Xin chào,</p>
        <p>Chúng tôi đã nhận được yêu cầu xác minh địa chỉ email này. Vui lòng sử dụng mã xác minh bên dưới để tiếp tục:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="
            display: inline-block;
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 3px;
            color: #2d7ef7;
            background: #eef5ff;
            padding: 10px 20px;
            border-radius: 8px;
          ">
            ${escapeHtml(code)}
          </span>
        </div>
        <p style="color: #666;">
          Mã xác minh sẽ hết hạn sau một khoảng thời gian ngắn vì lý do bảo mật.
        </p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>
      </div>
      <div style="
        margin-top: 30px;
        font-size: 12px;
        color: #999;
        text-align: center;
      ">
        <p>Đây là email tự động, vui lòng không phản hồi.</p>
        <p>© ${new Date().getFullYear()} Hệ thống của bạn. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;

  await sendMail({
    to:      email,
    subject: 'Xác minh email',
    html:    content,
  });

  return code;
}

module.exports = {
  sendEmail,
  sendLoginNotification,
  sendVerificationEmail,
};
