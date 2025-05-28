// controllers/authController.js
const User = require('../models/User');
const Role = require('../models/Role');
const jwt = require('jsonwebtoken');
exports.register = async (req,res) => {
  const { username, email, password, roleName, role, agencyId , avatar } = req.body;
  console.log(role);
  const r = await Role.findOne({ name: roleName }) || await Role.findById( role );
  const user = new User({ username, email, password, role: r._id, agency: agencyId, avatar });
  await user.save();
  res.json({ message: 'Registered' });
};
exports.login = async (req,res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if(!user) return res.status(400).json({ error: 'Invalid credentials' });
  const match = await require('bcrypt').compare(password, user.password);
  if(!match) return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
};