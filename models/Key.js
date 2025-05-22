// models/Key.js
const mongoose = require('mongoose'); // Cần dòng này trước khi sử dụng mongoose

const KeySchema = new mongoose.Schema({
  token:   { type: String, unique: true, required: true, index: true },
  branch:  { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  status:  { type: String, enum: ['issued','used','revoked'], default: 'issued' },
  userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dateStartUse: { type: Date, required: true, default: Date.now},
  dateEndUse: { type: Date, required: true, default: Date.now},
  issuedAt: { type: Date, default: Date.now }
});

KeySchema.pre('save', async function(next) {
  if (this.userIds && this.userIds.length > 0) {
    const users = await mongoose.model('User').find({ _id: { $in: this.userIds } });
    if (users.length !== this.userIds.length) {
      return next(new Error('Một hoặc nhiều userId không hợp lệ'));
    }
  }
  next();
});

module.exports = mongoose.model('Key', KeySchema);
