// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Schema cho thông tin đăng nhập qua social (Google, Facebook, Twitter)
const SocialAccountSchema = new mongoose.Schema(
  {
    provider: { 
      type: String, 
      enum: ['google', 'facebook', 'twitter'], 
      required: true 
    },
    providerId: { 
      type: String, 
      required: true 
    },
    displayName: { type: String },
    email: { type: String },
    photo: { type: String }
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
    
    // Sửa "require" thành "required" cho field state
    state: { type: String, enum: ['online', 'offline'], required: true, default: 'online' },
    lastSeen: { type: Date, default: Date.now },
    avatar: { type: String, default: '' },
    devices: [
      {
        deviceId: { type: String, required: true, default: '' },
        deviceName: { type: String, default: '' },
        lastActive: { type: Date, default: Date.now },
      },
    ],

    // Thêm mảng để lưu trữ các thông tin đăng nhập ở dịch vụ xã hội
    socialAccounts: {
      type: [SocialAccountSchema],
      default: []
    },
  },
  {
    timestamps: true // Tự động tạo các field createdAt, updatedAt nếu cần
  }
);

// Middleware trước khi lưu: mã hóa mật khẩu nếu password được thay đổi
UserSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// Middleware cho findOneAndUpdate: nếu cập nhật password thì mã hóa nó
UserSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update.password) {
    const hashed = await bcrypt.hash(update.password, 10);
    // Cập nhật lại password đã được mã hóa
    this.setUpdate({ ...update, password: hashed });
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
