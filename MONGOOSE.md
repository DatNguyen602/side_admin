# Bài giảng chi tiết về Mongoose trong Node.js

## Mục lục

1. [Giới thiệu về Mongoose](#giới-thiệu-về-mongoose)
2. [Cài đặt và thiết lập dự án](#cài-đặt-và-thiết-lập-dự-án)
3. [Kết nối đến MongoDB](#kết-nối-đến-mongodb)
4. [Schema và Model](#schema-và-model)

   * 4.1 Định nghĩa Schema
   * 4.2 Tạo Model
   * 4.3 Virtuals và Getters/Setters
   * 4.4 Schema Options
5. [CRUD operations](#crud-operations)
6. [Query nâng cao](#query-nâng-cao)

   * 6.1 Query Builder
   * 6.2 Lean Queries
   * 6.3 Pagination và Cursor
7. [Validation và Mongoose Schema Types](#validation-và-mongoose-schema-types)
8. [Middleware (Hooks)](#middleware-hooks)
9. [Populate và References](#populate-và-references)
10. [Aggregation Framework](#aggregation-framework)
11. [Indexing](#indexing)
12. [Transactions](#transactions)
13. [Error Handling và Debug](#error-handling-và-debug)
14. [Plugins và Mở rộng](#plugins-và-mở-rộng)
15. [Discriminators (Schema kế thừa)](#discriminators-schema-kế-thừa)
16. [Đồng bộ TypeScript](#đồng-bộ-typescript)
17. [Change Streams và Watchers](#change-streams-và-watchers)
18. [Best Practices và Tối ưu hiệu năng](#best-practices-và-tối-ưu-hiệu-năng)
19. [Tài nguyên tham khảo](#tài-nguyên-tham-khảo)

---

## 1. Giới thiệu về Mongoose

Mongoose là một thư viện ODM (Object Data Modeling) cho MongoDB và Node.js, cung cấp:

* Cấu trúc schema rõ ràng cho dữ liệu MongoDB.
* Validation dữ liệu, middleware (pre/post hooks).
* Hỗ trợ population giữa các collection.
* Hỗ trợ aggregation và change streams.
* Tương thích tốt với TypeScript.

Mục tiêu của Mongoose là giúp bạn làm việc với MongoDB theo cách có cấu trúc, kiểu an toàn và dễ bảo trì.

## 2. Cài đặt và thiết lập dự án

1. Khởi tạo dự án Node.js:

   ```bash
   npm init -y
   ```
2. Cài đặt Mongoose:

   ```bash
   npm install mongoose
   ```
3. (Tùy chọn) Cài đặt TypeScript và types:

   ```bash
   npm install typescript @types/mongoose --save-dev
   npx tsc --init
   ```
4. Tạo file ứng dụng chính, ví dụ `app.js` hoặc `index.ts`.

## 3. Kết nối đến MongoDB

Sử dụng `mongoose.connect()` để kết nối:

```js
const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mydb', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // timeout
      maxPoolSize: 10, // connection pool
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('Connection error', err);
    process.exit(1);
  }
}

connectDB();
```

**Event listeners**:

```js
mongoose.connection.on('connected', () => console.log('Mongoose connected'));
mongoose.connection.on('error', err => console.error(err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));
```

## 4. Schema và Model

### 4.1 Định nghĩa Schema

Schema là thiết kế cấu trúc tài liệu:

```js
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  roles: { type: [String], default: ['user'] },
  profile: {
    age: Number,
    address: String,
  },
}, {
  timestamps: true,         // createdAt & updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});
```

### 4.2 Tạo Model

```js
const User = mongoose.model('User', userSchema);
```

### 4.3 Virtuals và Getters/Setters

```js
// Virtual field
userSchema.virtual('profile.fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Getter
userSchema.path('email').get(v => v.toUpperCase());

// Setter
userSchema.path('name').set(v => v.trim());
```

### 4.4 Schema Options

* `timestamps`: tự động thêm `createdAt`, `updatedAt`.
* `versionKey`: `_v` mặc định, có thể vô hiệu hóa.
* `strict`: loại bỏ field không có trong schema.

## 5. CRUD operations

### Create

```js
const user = new User({ name, email, password });
await user.save();
```

### Read

```js
await User.find();
await User.findById(id).select('-password');
await User.findOne({ email: 'a@b.com' }).lean();
```

### Update

```js
await User.updateOne({ _id: id }, { $set: { name: 'New' } }, { runValidators: true });
await User.findByIdAndUpdate(id, { email: newEmail }, { new: true });
```

### Delete

```js
await User.deleteOne({ _id: id });
await User.findByIdAndDelete(id);
```

## 6. Query nâng cao

### 6.1 Query Builder

```js
const query = User.find()
  .where('age').gte(18)
  .where('roles').in(['admin'])
  .sort('-createdAt')
  .limit(10)
  .select('name email');
const results = await query.exec();
```

### 6.2 Lean Queries

Sử dụng `.lean()` để trả về plain JS object, tăng tốc độ, giảm overhead của Mongoose document.

### 6.3 Pagination và Cursor

Sử dụng `skip()` & `limit()`, hoặc `cursor()` với streaming:

```js
const cursor = User.find().cursor();
for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
  // xử lý doc
}
```

## 7. Validation và Mongoose Schema Types

Validation tích hợp:

```js
email: {
  type: String,
  required: [true, 'Email bắt buộc'],
  match: [/.+@.+\..+/, 'Email không hợp lệ'],
},
age: { type: Number, min: 0, max: 120 },
```

Ngoài ra có thể tự định nghĩa validator:

```js
userSchema.path('email').validate(async function(value) {
  const count = await mongoose.models.User.countDocuments({ email: value });
  return !count;
}, 'Email đã tồn tại');
```

## 8. Middleware (Hooks)

Pre / Post middleware:

```js
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await hash(this.password);
  next();
});

userSchema.post('remove', doc => console.log('Removed:', doc));
```

Hỗ trợ cả query middleware: `pre('find')`, `post('findOneAndUpdate')`, v.v.

## 9. Populate và References

```js
const postSchema = new mongoose.Schema({ author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, ... });
const Post = mongoose.model('Post', postSchema);

const post = await Post.findById(id).populate({ path: 'author', select: 'name email' });
```

Hỗ trợ `populate` nested, `populate()` multiple fields.

## 10. Aggregation Framework

Sử dụng pipeline:

```js
const stats = await User.aggregate([
  { $match: { age: { $gte: 18 } } },
  { $group: { _id: '$roles', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

Kết hợp `$lookup`, `$unwind`, `$project`, v.v.

## 11. Indexing

```js
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
```

Sử dụng `mongoose.set('autoIndex', false)` trong production và tạo index thủ công.

## 12. Transactions

```js
const session = await mongoose.startSession();
await session.withTransaction(async () => {
  await ModelA.create([{...}], { session });
  await ModelB.updateOne(..., { session });
});
session.endSession();
```

## 13. Error Handling và Debug

Bật debug:

```js
mongoose.set('debug', true);
```

Xử lý lỗi validation:

```js
try { await doc.save(); } catch (err) {
  if (err.name === 'ValidationError') console.error(err.errors);
}
```

## 14. Plugins và Mở rộng

Ví dụ `mongoose-paginate-v2`, `mongoose-unique-validator`:

```js
const paginate = require('mongoose-paginate-v2');
userSchema.plugin(paginate);
```

## 15. Discriminators (Schema kế thừa)

```js
const options = { discriminatorKey: 'kind' };
const baseSchema = new mongoose.Schema({ name: String }, options);
const Base = mongoose.model('Base', baseSchema);
const Cat = Base.discriminator('Cat', new mongoose.Schema({ meow: Boolean }));
```

## 16. Đồng bộ TypeScript

```ts
import { Schema, model, Document } from 'mongoose';
interface IUser extends Document { name: string; email: string; }
const userSchema = new Schema<IUser>({ name: String, email: String });
export const User = model<IUser>('User', userSchema);
```

## 17. Change Streams và Watchers

```js
const changeStream = User.watch();
changeStream.on('change', data => console.log(data));
```

Hữu ích cho real-time event, syncing.

## 18. Best Practices và Tối ưu hiệu năng

* Tách schema và model ra module riêng.
* Sử dụng `.lean()` khi không cần methods.
* Sử dụng projection để chỉ lấy field cần thiết.
* Giới hạn kết quả bằng pagination.
* Tắt autoIndex trong production.
* Sử dụng connection pooling và timeouts hợp lý.
* Ghi log và monitoring kết nối, query chậm.

## 19. Tài nguyên tham khảo

* [Mongoose Official Documentation](https://mongoosejs.com/)
* [MongoDB Manual](https://docs.mongodb.com/manual/)
* [Node.js Official](https://nodejs.org/)
* [TypeScript + Mongoose](https://mongoosejs.com/docs/typescript.html)

---

*Bài giảng đã được mở rộng với các tính năng và kịch bản nâng cao của Mongoose.*
