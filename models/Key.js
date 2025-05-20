// models/Key.js
const mongoose = require('mongoose'); // Cần dòng này trước khi sử dụng mongoose

const KeySchema = new mongoose.Schema({
  token:   { type: String, unique: true, required: true, index: true },
  branch:  { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  status:  { type: String, enum: ['issued','used','revoked'], default: 'issued' },
  issuedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Key', KeySchema);
