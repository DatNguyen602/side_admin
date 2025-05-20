// models/Branch.js
const mongoose = require('mongoose'); // Cần dòng này trước khi sử dụng mongoose

const BranchSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  agency:   { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
  location: String
});
module.exports = mongoose.model('Branch', BranchSchema);
