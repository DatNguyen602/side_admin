// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: "Agency" },
    state: { type: String, enum: ['online', 'offline'], require, default: 'online'},
    lastSeen: { type: Date, default: Date.now },
    avatar: { type: String, default: '' },
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

UserSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();

    if (update.password) {
        const hashed = await bcrypt.hash(update.password, 10);
        this.setUpdate({ ...update, password: hashed });
    }

    next();
});

module.exports = mongoose.model("User", UserSchema);
