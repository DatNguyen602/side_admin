// routes/auth.js
const express = require("express");
const passport = require("passport");
const asyncHandler = require("express-async-handler");
const { login } = require("../controllers/authController");

const router = express.Router();

// === Cấu hình chung ===
const VALID_REDIRECT_URIS = [
  "http://localhost:3000/oauth-callback",
  // thêm nếu cần
];

function isValidRedirectUri(uri) {
  return VALID_REDIRECT_URIS.includes(uri);
}

function createFakeRes() {
  return {
    statusCode: 200,
    data: null,
    json(obj) {
      this.data = obj;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

async function loginAndGetToken({ username, password }) {
  const fakeRes = createFakeRes();
  await login({ body: { username, password } }, fakeRes);
  if (fakeRes.statusCode >= 400 || !fakeRes.data?.token) {
    throw new Error(fakeRes.data?.error || "Login failed");
  }
  return fakeRes.data.token;
}

// === Middleware khởi tạo OAuth (API/popup) ===
function oauthApiInitiate(providerName) {
  return (req, res, next) => {
    const redirectUri = req.query.redirect_uri || VALID_REDIRECT_URIS[0];
    if (!isValidRedirectUri(redirectUri)) {
      return res.status(400).send("Invalid redirect_uri");
    }
    const state = Buffer.from(JSON.stringify({ redirectUri })).toString(
      "base64",
    );
    req.session.oauthState = state;

    passport.authenticate(providerName, {
      scope: ["profile", "email"],
      state,
    })(req, res, next);
  };
}

// === Handler chung cho OAuth callback (API/popup) ===
function oauthApiCallback(providerName) {
  return asyncHandler(async (req, res, next) => {
    passport.authenticate(providerName, {
      session: false,
      failureRedirect: "/",
    })(req, res, async () => {
      // parse state
      let redirectUri = VALID_REDIRECT_URIS[0];
      try {
        const raw = req.query.state || req.session.oauthState;
        const parsed = JSON.parse(Buffer.from(raw, "base64").toString());
        if (isValidRedirectUri(parsed.redirectUri)) {
          redirectUri = parsed.redirectUri;
        }
      } catch {}

      try {
        const token = await loginAndGetToken(req.user);
        return res.redirect(`${redirectUri}?token=${token}`);
      } catch {
        return res.redirect(`${redirectUri}?error=login_failed`);
      }
    });
  });
}

// === Middleware khởi tạo OAuth (web/redirect) ===
function oauthWebInitiate(providerName) {
  return passport.authenticate(providerName, { scope: ["profile", "email"] });
}

function oauthWebCallback(providerName) {
  return asyncHandler(async (req, res, next) => {
    passport.authenticate(providerName, {
      session: false,
      failureRedirect: "/",
    })(req, res, async () => {
      try {
        const token = await loginAndGetToken(req.user);
        res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
        res.redirect("/viewer/dashboard");
      } catch (err) {
        res.render("login", {
          title: "Đăng nhập",
          error: err.message,
          query: req.query,
        });
      }
    });
  });
}

// === Định nghĩa routes ===
// Google OAuth (API / popup)
router.get("/api/google", oauthApiInitiate("google-api"));
router.get("/google/callback/api", oauthApiCallback("google-api"));

// Google OAuth (Web redirect)
router.get("/google", oauthWebInitiate("google-web"));
router.get("/google/callback", oauthWebCallback("google-web"));

// Facebook OAuth (Web redirect)
router.get("/facebook", oauthWebInitiate("facebook"));
router.get("/facebook/callback", oauthWebCallback("facebook"));

// Twitter OAuth (Web redirect)
router.get("/twitter", passport.authenticate("twitter"));
router.get(
  "/twitter/callback",
  passport.authenticate("twitter", { failureRedirect: "/" }),
  (req, res) => res.redirect("/profile"),
);

// Profile
router.get("/profile", (req, res) => {
  if (!req.user) return res.redirect("/");
  res.send(`Chào ${req.user.displayName}`);
});

module.exports = router;
