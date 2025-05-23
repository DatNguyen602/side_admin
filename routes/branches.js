// routes/branches.js
const router = require('express').Router();
const rbac = require('../middleware/rbac');
const c = require('../controllers/branchController');
router.get('/', rbac('branch:read'), c.list);
router.get('/:id', rbac('branch:read'), c.get);
module.exports = router;