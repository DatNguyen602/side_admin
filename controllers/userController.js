// controllers/userController.js
const UserModel = require('../models/User');
exports.list = async (req,res) => {
  const { page=1, limit=10 } = req.query;
  const users = await UserModel.find()
    .skip((page-1)*limit).limit(+limit)
    .populate('role agency');
  res.json(users);
};
exports.get = async (req,res) => {
  const user = await UserModel.findById(req.params.id).populate('role agency');
  res.json(user);
};
exports.update = async (req,res) => {
  await UserModel.findByIdAndUpdate(req.params.id, req.body);
  res.json({ message: 'Updated' });
};
exports.remove = async (req,res) => {
  await UserModel.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};