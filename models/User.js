// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Schema cho thông tin đăng nhập qua social (Google, Facebook, Twitter)
const SocialAccountSchema = new mongoose.Schema(
    {
        provider: {
            type: String,
            enum: ["google", "facebook", "twitter"],
            required: true,
        },
        providerId: {
            type: String,
            required: true,
        },
        displayName: { type: String },
        email: { type: String },
        photo: { type: String },
    },
    { _id: false } // không cần tạo _id riêng cho subdocument này
);

const UserSchema = new mongoose.Schema(
    {
        username: { type: String, unique: true, required: true },
        email: { type: String, unique: true, required: true },
        password: { type: String, required: true },
        role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
        agency: { type: mongoose.Schema.Types.ObjectId, ref: "Agency" },
        protected: { type: Boolean, default: false },
        state: {
            type: String,
            enum: ["online", "offline"],
            required: true,
            default: "online",
        },
        lastSeen: { type: Date, default: Date.now },
        avatar: { type: String, default: "" },
        path: { type: String, default: "" },
        devices: [
            {
                deviceId: { type: String, required: true, default: "" },
                deviceName: { type: String, default: "" },
                lastActive: { type: Date, default: Date.now },
            },
        ],

        socialAccounts: {
            type: [SocialAccountSchema],
            default: [],
        },
    },
    {
        timestamps: true, // Tự động tạo các field createdAt, updatedAt nếu cần
    }
);

UserSchema.pre("save", async function (next) {
    if (this.protected) {
        const existing = await mongoose.models.User.findOne({
            protected: true,
            _id: { $ne: this._id },
        });
        if (existing) {
            return next(new Error("Only one user can have protected: true"));
        }
    }

    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }

    next();
});

UserSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();

    // Trường hợp đang cố gắng set protected = true
    if (update.protected === true) {
        const query = this.getQuery(); // Lấy điều kiện filter
        const currentUser = await mongoose.models.User.findOne(query);

        const existing = await mongoose.models.User.findOne({
            protected: true,
            _id: { $ne: currentUser?._id },
        });

        if (existing) {
            return next(new Error("Only one user can have protected: true"));
        }
    }

    if (update.password) {
        const hashed = await bcrypt.hash(update.password, 10);
        this.setUpdate({ ...update, password: hashed });
    }

    next();
});

module.exports = mongoose.model("User", UserSchema);
