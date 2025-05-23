// models/Role.js
const mongoose = require('mongoose');
const RoleSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  permissions: [String]   // e.g. ['user:create','key:verify']
});
module.exports = mongoose.model('Role', RoleSchema);
