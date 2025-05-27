const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: "Agency" },
    state: { type: String, enum: ['online', 'offline'], require, default: 'online'},
    devices: [
        {
            deviceId: { type: String, required: true, default: '' },
            deviceName: { type: String, default: '' },
            lastActive: { type: Date, default: Date.now },
        },
    ],
});

UserSchema.pre("save", async function () {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
});

module.exports = mongoose.model("User", UserSchema);
