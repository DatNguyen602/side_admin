// routes/agencies.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/agencyController');
router.get('/', rbac('agency:read'), c.list);
router.get('/:id', rbac('agency:read'), c.get);
module.exports = router;