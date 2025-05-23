// routes/users.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { list, get, update, remove } = require('../controllers/userController');
router.use(auth);
router.get('/', rbac('user:read'), list);
router.get('/:id', rbac('user:read'), get);
module.exports = router;