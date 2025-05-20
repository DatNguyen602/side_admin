// routes/agencies.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/agencyController');
router.use(auth);
router.get('/', rbac('agencies:read'), c.list);
router.post('/', rbac('agencies:create'), c.create);
router.get('/:id', rbac('agencies:read'), c.get);
router.put('/:id', rbac('agencies:update'), c.update);
router.delete('/:id', rbac('agencies:delete'), c.remove);
module.exports = router;