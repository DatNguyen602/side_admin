// models/Session.js
const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key:     { type: mongoose.Schema.Types.ObjectId, ref: 'Key', required: true },
  startedAt: { type: Date, default: Date.now },
  endedAt:   { type: Date }
});

module.exports = mongoose.model('Session', SessionSchema);
