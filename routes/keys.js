// routes/keys.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const rbac = require("../middleware/rbac");
const c = require("../controllers/keyController");
router.get("/verify/:token", c.verify);
router.use(auth);
router.get("/", rbac("keys:read"), c.list);
router.post("/", rbac("keys:create"), c.create);
router.put("/:id", rbac("keys:update"), c.update);
router.delete("/:id", rbac("keys:delete"), c.remove);
module.exports = router;
