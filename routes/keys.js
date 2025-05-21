const router = require("express").Router();
const rbac = require("../middleware/rbac");
const c = require("../controllers/keyController");

router.get("/", c.list);
router.get("/verify/:token", c.verify);

// API đăng ký phiên làm việc
router.post("/session/start", c.createSession);
router.post("/session/login", c.loginAndCreateSession);
// API hủy phiên làm việc
router.post("/session/cancel", c.cancelSession);
router.post("/session/logout", c.loginAndCancelSession);
// Chỉ admin hoặc người có quyền đọc session mới xem được
router.get("/sessions", rbac("sessions:read"), c.listSessions);

module.exports = router;
