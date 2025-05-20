// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email:    { type: String, unique: true, required: true },  // thêm email
  password: { type: String, required: true },
  role:     { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  agency:   { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' }
});

UserSchema.pre('save', async function() {
  if(this.isModified('password')){
    this.password = await bcrypt.hash(this.password, 10);
  }
});

module.exports = mongoose.model('User', UserSchema);
