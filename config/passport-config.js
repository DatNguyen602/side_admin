const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
require('dotenv').config();

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
    if (!user.avatar && profile.photos && profile.photos[0]?.value) {
      user.avatar = profile.photos[0].value;
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
      avatar: profile.photos?.[0]?.value,
      socialAccounts: [{
        provider: provider,
        providerId: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        photo: profile.photos?.[0]?.value
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
passport.use(new GoogleStrategy({
  clientID: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
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
    const user = await handleSocialLogin("facebook", profile);
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
