const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
require('dotenv').config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const User = require('../models/User');
const Role = require('../models/Role');

// Serialize và deserialize cho session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Hàm tải ảnh và lưu vào thư mục
async function downloadAvatar(url, userId) {
  const avatarPath = path.join(__dirname, "../public/uploads/avatars", `${userId}.jpg`);

  // Kiểm tra nếu avatar đã tồn tại
  if (fs.existsSync(avatarPath)) {
    return `/uploads/avatars/${userId}.jpg`;
  }

  try {
    const response = await axios({
      url,
      responseType: "stream",
    });

    // Lưu ảnh vào thư mục
    const writer = fs.createWriteStream(avatarPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(`/uploads/avatars/${userId}.jpg`));
      writer.on("error", reject);
    });

  } catch (error) {
    console.error("Error downloading avatar:", error);
    return null;
  }
}

/**
 * Hàm xử lý đăng nhập mạng xã hội:
 *  - Tìm user theo socialAccounts (provider và providerId)
 *  - Nếu không có, thử tìm theo email (nếu có)
 *  - Nếu tìm thấy, cập nhật thông tin socialAccounts
 *  - Nếu không, tạo mới user với thông tin nhận được
 *
 * @param {String} provider - Tên nhà cung cấp ('google', 'facebook', 'twitter')
 * @param {Object} profile - Thông tin profile từ provider
 * @returns {User} user được tìm thấy hoặc tạo mới
 */
async function handleSocialLogin(provider, profile) {
  // Tìm user có social account với provider tương ứng và providerId
  let user = await User.findOne({ "socialAccounts.provider": provider, "socialAccounts.providerId": profile.id });

  // Nếu chưa tìm thấy, thử tìm theo email nếu profile cung cấp email
  if (!user && profile.emails && profile.emails[0]?.value) {
    user = await User.findOne({ email: profile.emails[0].value });
  }

  const avatarUrl = profile.photos?.[0]?.value;
  const avatarPath = avatarUrl ? process.env.DOMAIN + await downloadAvatar(avatarUrl, profile.id) : null;

  if (user) {
    // Nếu user tồn tại, cập nhật hoặc thêm mới thông tin social account
    let socialAcc = user.socialAccounts.find(acc => acc.provider === provider);
    if (socialAcc) {
      // Cập nhật thông tin mới
      socialAcc.displayName = profile.displayName;
      socialAcc.email = profile.emails?.[0]?.value;
      socialAcc.photo = profile.photos?.[0]?.value;
    } else {
      // Thêm thông tin social account mới
      user.socialAccounts.push({
        provider: provider,
        providerId: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        photo: profile.photos?.[0]?.value
      });
    }
    // Nếu avatar chưa được thiết lập, có thể cập nhật theo thông tin từ profile
    if ( avatarPath) {
      user.avatar = avatarPath;
    }
    await user.save();
  } else {
    // Nếu user không tồn tại, tạo mới user với dữ liệu cơ bản và lưu thông tin socialAccount
    const role = await Role.findOne({ name: "viewer" });
    user = new User({
      username: profile.displayName,
      email: profile.emails?.[0]?.value,
      password: profile.id,
      role: role ? role._id : null,
      avatar: avatarPath,
      path: profile.photos?.[0]?.value,
      socialAccounts: [{
        provider: provider,
        providerId: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        photo: avatarPath
      }]
    });
    await user.save();
  }
  const userObj = user.toObject();
  userObj.password = profile.id;
  return userObj;
}

// ========================
// GOOGLE STRATEGY
// ========================
// Strategy dùng cho giao diện web
passport.use('google-web', new GoogleStrategy({
  clientID: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL, // URL đã đăng ký cho giao diện
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await handleSocialLogin("google", profile);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Strategy dùng cho API (trả về JSON)
passport.use('google-api', new GoogleStrategy({
  clientID: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL + '/api', // URL đã đăng ký cho API
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await handleSocialLogin("google", profile);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// ========================
// FACEBOOK STRATEGY
// ========================
passport.use(new FacebookStrategy({
  clientID: process.env.FB_APP_ID,
  clientSecret: process.env.FB_APP_SECRET,
  callbackURL: process.env.FB_CALLBACK_URL,
  profileFields: ['id', 'displayName', 'emails', 'photos']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log(profile)
    const user = await handleSocialLogin("facebook", profile);
    console.log(user)
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// ========================
// TWITTER STRATEGY
// ========================
passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_KEY,
  consumerSecret: process.env.TWITTER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL,
  includeEmail: true
}, async (token, tokenSecret, profile, done) => {
  try {
    const user = await handleSocialLogin("twitter", profile);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

module.exports = passport;
