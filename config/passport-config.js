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

// ========================
// GOOGLE STRATEGY
// ========================
passport.use(new GoogleStrategy({
  clientID: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Tìm user theo googleId hoặc email (profile.emails[0].value)
        console.log(profile)
        let u = await User.findOne({ username: profile.displayName });
        if (!u) {
            // Nếu chưa có, tạo mới
            const roleId = await Role.findOne({ name: "viewer" });
            u = new User({
                username: profile.displayName,
                email: profile.emails[0].value,
                password: profile.id,
                role: roleId,
                avatar: profile.photos?.[0]?.value
            });
            await u.save();
        }
        const user = {
            u,
            username: u.username,
            password: profile.id
        }
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
  profileFields: ['id', 'displayName', 'emails']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Tìm user theo googleId hoặc email (profile.emails[0].value)
        let u = await User.findOne({ username: profile.displayName });
        if (!u) {
            // Nếu chưa có, tạo mới
            const roleId = await Role.findOne({ name: "viewer" });
            u = new User({
                username: profile.displayName,
                email: profile.emails[0].value,
                password: profile.id,
                role: roleId
            });
            await u.save();
        }
        const user = {
            u,
            username: u.username,
            password: profile.id
        }
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
        // Tìm user theo googleId hoặc email (profile.emails[0].value)
        let u = await User.findOne({ username: profile.displayName });
        if (!u) {
            // Nếu chưa có, tạo mới
            const roleId = await Role.findOne({ name: "viewer" });
            u = new User({
                username: profile.displayName,
                email: profile.emails[0].value,
                password: profile.id,
                role: roleId
            });
            await u.save();
        }
        const user = {
            u,
            username: u.username,
            password: profile.id
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));
