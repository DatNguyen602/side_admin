// controllers/keyController.js
const Key = require('../models/Key');
exports.list = (req,res) => Key.find().populate({ path: 'branch', populate: 'agency' }).then(k=>res.json(k));
exports.create = async (req,res) => {
  const token = require('crypto').randomBytes(16).toString('hex');
  const key = await Key.create({ token, branch: req.body.branchId });
  res.json(key);
};
exports.verify = async (req,res) => {
  const key = await Key.findOne({ token: req.params.token });
  if(!key) return res.json({ exists: false });
  res.json({ exists: true, status: key.status });
};
exports.update = async (req,res) => {
  await Key.findByIdAndUpdate(req.params.id, req.body);
  res.json({ message: 'Key updated' });
};
exports.remove = async (req,res) => {
  await Key.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};