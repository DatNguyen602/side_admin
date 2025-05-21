// routes/branches.js
const router = require('express').Router();
const rbac = require('../middleware/rbac');
const c = require('../controllers/branchController');
router.get('/', rbac('branches:read'), c.list);
router.get('/:id', rbac('branches:read'), c.get);
module.exports = router;