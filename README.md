# 🔐 Hệ thống Quản Lý Key và Phiên Làm Việc

Một hệ thống RESTful API sử dụng **Node.js**, **Express**, **MongoDB** để quản lý:
- Các **key truy cập** theo chi nhánh và đại lý
- **Phiên làm việc (session)** giữa người dùng và key
- Hỗ trợ xác thực bằng `username/password` hoặc `userId`

---

## 📦 Công nghệ sử dụng

- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Mongoose](https://mongoosejs.com/)
- [JWT (JSON Web Token)](https://jwt.io/)
- [bcrypt](https://www.npmjs.com/package/bcrypt) (mã hóa mật khẩu)

---

## ⚙️ Cài đặt

### 1. Clone dự án

```bash
git clone https://github.com/{___}/key-session-api.git
cd key-session-api
```

### 2. Cài đặt dependency

```bash
npm install
```

### 3. Khởi tạo biến môi trường `.env`

Tạo file `.env` trong thư mục gốc với nội dung:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/key-session-db
JWT_SECRET=your-random-generated-secret
```

> 🔑 Để tạo `JWT_SECRET`, chạy:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🚀 Khởi động server

```bash
npm run dev
```

Server sẽ chạy tại:  
```
http://localhost:5000/
```

---

## 🔐 Các API chính

### ✅ 1. Tạo phiên làm việc (Login Session)

#### a. Dùng `userId` và `token`

**POST** `/api/v1/keys/session/start`

**Request body:**
```json
{
  "token": "abcdef1234567890",
  "userId": "user-id-string"
}
```

#### b. Dùng `username/password` và `token`

**POST** `/api/keys/session/login`

**Request body:**
```json
{
  "username": "demo",
  "password": "123456",
  "token": "abcdef1234567890"
}
```

---

### ❌ 2. Hủy phiên làm việc (Logout Session)

#### a. Dùng `userId` và `token`

**POST** `/api/v1/keys/session/cancel`

**Request body:**
```json
{
  "token": "abcdef1234567890",
  "userId": "user-id-string"
}
```

#### b. Dùng `username/password` và `token`

**POST** `/api/keys/session/logout`

**Request body:**
```json
{
  "username": "demo",
  "password": "123456",
  "token": "abcdef1234567890"
}
```

---

## 📚 Các API khác

### 📄 Kiểm tra key hợp lệ

**GET** `/api/v1/keys/verify/:token`

Trả về trạng thái key:
```json
{
  "exists": true,
  "status": "used"
}
```

---

### 🗂 Danh sách key

**GET** `/api/v1/keys`

Trả về danh sách tất cả key (có populate branch & agency).

---

### 🧑‍💼 Danh sách phiên làm việc (admin)

**GET** `/api/v1/keys/sessions`

> Yêu cầu quyền `sessions:read`.

Trả về danh sách các phiên làm việc đang hoạt động hoặc đã kết thúc.

---

## 🔐 Cấu trúc dữ liệu chính

### 🔑 Key
```js
{
  token: String,
  status: "issued" | "used" | "revoked",
  branch: ObjectId (ref Branch)
}
```

### 📦 Session
```js
{
  user: ObjectId (ref User),
  key: ObjectId (ref Key),
  startedAt: Date,
  endedAt: Date (nullable)
}
```

### 👤 User
```js
{
  username: String,
  email: String,
  password: String (bcrypt hash),
  role: ObjectId (ref Role),
  agency: ObjectId (ref Agency)
}
```

---

## 📂 Cấu trúc thư mục

```
.
├── controllers/
│   └── keyController.js
├── models/
│   ├── Key.js
│   ├── Session.js
│   ├── User.js
│   └── ...
├── routes/
│   └── keyRoutes.js
├── middleware/
│   ├── auth.js
│   └── rbac.js
├── .env
├── app.js
└── README.md
```

---

## 📌 Ghi chú

- Tất cả mật khẩu người dùng được mã hóa bằng `bcrypt`.
- Mỗi `key` chỉ được dùng một lần trừ khi hủy phiên (`cancel`) sẽ trả lại trạng thái `issued`.
- Để thu hồi key vĩnh viễn, chuyển trạng thái sang `revoked`.

---

## 📮 Liên hệ

> Liên hệ: [hhay4317@gmail.com]  
> Dự án bởi: **Bạn và Cộng sự**