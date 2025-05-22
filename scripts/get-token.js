const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.OAUTH_CLIENT_ID,
  process.env.OAUTH_CLIENT_SECRET,
  'http://localhost:3000/oauth2callback' // Hoặc 'http://localhost' nếu dùng redirect
);

const SCOPES = ['https://mail.google.com/'];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
});

console.log('Vui lòng mở URL sau và dán mã xác nhận ở bước tiếp theo:\n', authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Nhập mã xác nhận: ', (code) => {
  rl.close();
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Lỗi khi lấy token:', err);
    console.log('✅ Access Token:', token.access_token);
    console.log('✅ Refresh Token:', token.refresh_token);
    console.log('⏳ Expiry Date:', new Date(token.expiry_date));
  });
});
