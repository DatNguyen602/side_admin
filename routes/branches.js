// routes/branches.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/branchController');
router.use(auth);
router.get('/', rbac('branches:read'), c.list);
router.post('/', rbac('branches:create'), c.create);
router.get('/:id', rbac('branches:read'), c.get);
router.put('/:id', rbac('branches:update'), c.update);
router.delete('/:id', rbac('branches:delete'), c.remove);
module.exports = router;