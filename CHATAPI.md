# 📘 Tài liệu Hướng Dẫn Triển Khai API Chat App

## ✅ Yêu cầu chung

* Tất cả request phải được **xác thực bằng JWT**, truyền qua header:

  ```
  Authorization: Bearer <token>
  ```

* Server chạy tại:

  ```
  http://localhost:5000
  ```

---

## 🔐 Đăng nhập và xác thực

> ⚠️ Cần API login để cấp JWT cho client

### `POST /api/v1/auth/login`

**Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**

```json
{
  "token": "JWT-token"
}
```

---

## 📨 Lấy lịch sử tin nhắn

### `GET /api/v1/users/messages/:roomId`

Trả về tất cả các tin nhắn của người dùng trong một phòng.

**Params:**

* `roomId`: ID của phòng chat

**Response:**

```json
[
  {
    "_id": "messageId",
    "room": "roomId",
    "sender": {
      "username": "user1",
      "avatar": "avatarUrl"
    },
    "contents": [
      {
        "type": "text",
        "data": "Hello!"
      },
      {
        "type": "image",
        "data": "/<fileId>",
        "originalName": "filename.png"
      }
    ],
    "createdAt": "timestamp"
  }
]
```

---

## 📤 Gửi tin nhắn (qua socket)

Sử dụng **Socket.IO**, client gửi:

```json
{
  "event": "message",
  "data": {
    "room": "<roomId>",
    "content": [
      {
        "type": "text",
        "data": "hello"
      },
      {
        "type": "image",
        "data": "/<fileId>"
      }
    ]
  }
}
```

---

## 📁 Upload file đính kèm

### `POST /file/upload`

**Headers:**

* `Authorization: Bearer <token>`

**Body:** `multipart/form-data`

* `file`: file media cần upload

**Response:**

```json
{
  "fileId": "abc123",
  "type": "image"
}
```

---

## 📅 Xem file đính kèm

### `GET /file/view/:fileId`

Trả về nội dung file media dùng nhúng vào HTML (`<img>`, `<video>`, `<audio>`...)

**Headers:**

* `Authorization: Bearer <token>`

---

## ⬇️ Tải file về

### `GET /file/download/:fileId`

Trả về file gốc từ server đã được giải mã.

**Headers:**

* `Authorization: Bearer <token>`

---

## 🖐️ Kết nối WebSocket

Client dùng:

```js
const socket = io("ws://localhost:5000", {
  auth: { token: "<JWT-token>" }
});
```

**Server phải cấu hình xác thực token qua socket.**

---

## 🧪 Phân loại file (sau khi upload)

File được phân loại tự động dựa vào MIME và tên:

| Điều kiện MIME / Tên | Loại file (type) |
| -------------------- | ---------------- |
| image/\* + sticker   | `"sticker"`      |
| image/\* < 100KB     | `"emoji"`        |
| image/\*             | `"image"`        |
| video/\*             | `"video"`        |
| audio/\*             | `"audio"`        |
| text/plain           | `"text"`         |
| khác                 | `"file"`         |

---

## 🛠️ Thư mục lưu trữ file

* File upload tạm thời: `uploads/temp_uploads/`
* File đã mã hóa: `uploads/uploads_encrypted/`
* Metadata: `fileId.meta.json`

---

## 📌 Ghi chú

* Mỗi `content` trong tin nhắn chứa `type`, `data` và nếu là media sẽ có `originalName`.
* Trong một tin nhắn có thể chứa nhiều `content` khác nhau.
* Backend nên tự động đốc metadata và gắn `originalName` khi trả về tin nhắn.
