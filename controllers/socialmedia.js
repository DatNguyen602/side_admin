const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
require('dotenv').config();

// Các biến cấu hình OAuth2
const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;

passport.use(new FacebookStrategy({
    clientID: 'FACEBOOK_APP_ID',
    clientSecret: 'FACEBOOK_APP_SECRET',
    callbackURL: '/auth/facebook/callback'
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.use(new TwitterStrategy({
    consumerKey: 'TWITTER_CONSUMER_KEY',
    consumerSecret: 'TWITTER_CONSUMER_SECRET',
    callbackURL: '/auth/twitter/callback'
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});
