// models/Agency.js
const mongoose = require("mongoose"); // Cần dòng này trước khi sử dụng mongoose

const AgencySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: String,
});
module.exports = mongoose.model("Agency", AgencySchema);
