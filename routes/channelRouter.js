// channelRouter.js

const express = require('express');
const bodyParser = require('body-parser');
const mediasoup = require('mediasoup');
const ChannelManager = require('../manager/channelManager');

const router = express.Router();

// Sử dụng bodyParser để parse JSON (nếu chưa được đặt trên app chính)
router.use(bodyParser.json());

// Cấu hình codecs cho mediasoup (ví dụ hỗ trợ audio Opus và video VP8)
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000
  }
];

let channelManager; // Sẽ được khởi tạo sau khi mediasoup Worker được tạo

// Hàm bất đồng bộ tự chạy ngay để khởi tạo mediasoup Worker và Channel Manager
(async () => {
  try {
    // Khởi tạo mediasoup Worker với cấu hình cơ bản
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999
    });

    // Khởi tạo Channel Manager với Worker vừa tạo và cấu hình media codecs
    channelManager = new ChannelManager({ worker, mediaCodecs });

    console.log('Mediasoup Worker và Channel Manager đã được khởi tạo');
  } catch (error) {
    console.error('Lỗi khởi tạo mediasoup Worker hoặc Channel Manager:', error);
    // Nếu khởi tạo thất bại, nên thoát ứng dụng
    process.exit(1);
  }
})();

/* Endpoint POST: Tạo channel mới.
   Khi channel được tạo, nó tự động khởi tạo 11 room (hội nghị) theo định dạng, ví dụ:
   channel123-conference-1, channel123-conference-2, ... */
router.post('/', async (req, res) => {
  try {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'channelId là bắt buộc' });
    }

    const channel = await channelManager.createChannel(channelId);
    // Trả về channelId cùng danh sách các room được tạo trong channel đó
    res.json({ channelId, roomIds: Array.from(channel.rooms.keys()) });
  } catch (error) {
    console.error('Lỗi khi tạo channel:', error);
    res.status(500).json({ error: error.message });
  }
});

/* Endpoint GET: Lấy thông tin RTP capabilities của một room cụ thể trong một channel.
   Đây là thông tin cần thiết cho client khi tạo Device (mediasoup-client) */
router.get('/:channelId/rooms/:roomId', (req, res) => {
  const { channelId, roomId } = req.params;
  const channel = channelManager.getChannel(channelId);
  if (!channel) {
    return res.status(404).send('Channel không tồn tại');
  }

  const room = channel.getRoom(roomId);
  if (!room) {
    return res.status(404).send('Room không tồn tại');
  }

  res.json({ rtpCapabilities: room.getRouterRtpCapabilities() });
});

module.exports = router;
