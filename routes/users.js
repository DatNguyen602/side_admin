// routes/users.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { list, get, update, remove } = require('../controllers/userController');
router.use(auth);
router.get('/', rbac('users:read'), list);
router.get('/:id', rbac('users:read'), get);
router.put('/:id', rbac('users:update'), update);
router.delete('/:id', rbac('users:delete'), remove);
module.exports = router;