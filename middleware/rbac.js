module.exports = (requiredPerm) => async (req, res, next) => {
  const Role = require('../models/Role');
  const role = await Role.findOne({ name: req.user.role }); // 🔍 dùng name thay vì _id
  if (!role) return res.status(404).json({ error: 'Role not found' });

  if (role.permissions.includes(requiredPerm)) return next();
  return res.status(403).json({ error: 'Forbidden' });
};
