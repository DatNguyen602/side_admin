const express = require('express');
const passport = require('passport');
const router = express.Router();
const { login } = require("../controllers/authController");

// Danh sách redirectUri hợp lệ (frontend callback URLs)
const VALID_REDIRECT_URIS = [
  "http://localhost:3000/oauth-callback",
  // Thêm URL frontend khác nếu cần
];

function isValidRedirectUri(uri) {
  return VALID_REDIRECT_URIS.includes(uri);
}

// Hàm xử lý login chung, trả token, redirect hoặc JSON tùy isApi
async function handleGoogleLogin(req, res, isApi = false) {
  const { username, password } = req.user;

  const fakeRes = {
    statusCode: 200,
    data: null,
    json(obj) { this.data = obj; },
    status(code) { this.statusCode = code; return this; },
  };

  await login({ body: { username, password } }, fakeRes);

  if (fakeRes.statusCode >= 400 || !fakeRes.data?.token) {
    if (isApi) {
      return res.status(401).json({ error: fakeRes.data?.error || "Đăng nhập thất bại" });
    }
    return res.render("login", {
      title: "Đăng nhập",
      error: fakeRes.data?.error || "Đăng nhập thất bại",
      query: req.query,
    });
  }

  // Đặt cookie token
  res.cookie("token", fakeRes.data.token, {
    httpOnly: true,
    sameSite: "lax",
  });

  if (isApi) {
    // Trả về JSON token
    return res.json({ token: fakeRes.data.token });
  } else {
    // Redirect vào trang dashboard
    return res.redirect("/viewer/dashboard");
  }
}

// --- OAuth Google API cho popup đa app ---

router.get('/auth/api/google', (req, res, next) => {
  const redirectUri = req.query.redirect_uri || VALID_REDIRECT_URIS[0];
  if (!isValidRedirectUri(redirectUri)) {
    return res.status(400).send("Invalid redirect_uri");
  }

  // Encode redirectUri trong state để callback lấy lại
  const state = Buffer.from(JSON.stringify({ redirectUri })).toString('base64');
  req.session.oauthState = state;

  passport.authenticate('google-api', {
    scope: ['profile', 'email'],
    state,
  })(req, res, next);
});

router.get('/auth/google/callback/api',
  passport.authenticate('google-api', { session: false, failureRedirect: '/' }),
  async (req, res) => {
    let redirectUri = VALID_REDIRECT_URIS[0];
    try {
      const stateRaw = req.query.state || req.session.oauthState;
      if (stateRaw) {
        const parsed = JSON.parse(Buffer.from(stateRaw, 'base64').toString());
        if (isValidRedirectUri(parsed.redirectUri)) redirectUri = parsed.redirectUri;
      }
    } catch {}

    // Lấy token từ login
    const { username, password } = req.user;
    const fakeRes = {
      statusCode: 200,
      data: null,
      json(obj) { this.data = obj; },
      status(code) { this.statusCode = code; return this; },
    };

    await login({ body: { username, password } }, fakeRes);

    if (!fakeRes.data?.token) {
      // Nếu lỗi, redirect kèm lỗi
      return res.redirect(`${redirectUri}?error=login_failed`);
    }

    // Redirect về FE callback, kèm token trong query param
    return res.redirect(`${redirectUri}?token=${fakeRes.data.token}`);
  }
);

// --- OAuth Google Web (truy cập trực tiếp, không dùng popup) ---

router.get('/auth/google', passport.authenticate('google-web', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback',
  passport.authenticate('google-web', { session: false, failureRedirect: '/' }),
  async (req, res) => {
    await handleGoogleLogin(req, res);
  }
);

// --- OAuth Facebook ---

router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/' }),
  async (req, res) => {
    // Bạn có thể xử lý tương tự tạo token như google
    res.redirect('/profile');
  }
);

// --- OAuth Twitter ---

router.get('/auth/twitter', passport.authenticate('twitter'));

router.get('/auth/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/' }),
  async (req, res) => {
    res.redirect('/profile');
  }
);

// Trang profile đơn giản
router.get('/profile', (req, res) => {
  if (!req.user) return res.redirect('/');
  res.send(`Chào ${req.user.displayName}`);
});

module.exports = router;
