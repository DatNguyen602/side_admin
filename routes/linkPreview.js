const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const router = express.Router();

// --- (1) Cấu hình cache tạm thời (tuỳ chọn) ---
const cache = new Map();
// Thời gian cache: 5 phút (theo milli giây)
const CACHE_TTL = 5 * 60 * 1000;

router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Thiếu tham số url' });
  }

  // --- (2) Kiểm tra URL hợp lệ ---
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL không hợp lệ' });
  }

  // --- (3) Kiểm tra cache (nếu có) ---
  const cacheEntry = cache.get(parsedUrl.href);
  if (cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_TTL)) {
    // Trả về ngay từ cache
    return res.json(cacheEntry.data);
  }

  // --- (4) Thiết lập timeout cho fetch ---
  const TIMEOUT_MS = 5000; // 5 giây timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        // Nhiều server chặn “bot”; giả làm browser
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/90.0.4430.85 Safari/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res
        .status(400)
        .json({ error: `Không thể fetch URL (status: ${response.status})` });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // --- (5) Build map chứa toàn bộ thẻ <meta> ở <head> ---
    const metaMap = {};
    $('head meta').each((i, el) => {
      const property = $(el).attr('property') || '';
      const name = $(el).attr('name') || '';
      const content = $(el).attr('content') || '';
      if (property.startsWith('og:')) {
        // Ví dụ: property="og:title" --> key = "og:title"
        metaMap[property] = content;
      } else if (name) {
        // Ví dụ: name="description" hoặc name="twitter:image"...
        metaMap[name] = content;
      }
    });

    // --- (6) Hàm helper để lấy meta: ưu tiên og:*, sau đó name=* ---
    const getMeta = (field) => {
      // Thử tìm "og:field" trước, nếu không có thì tìm name=field
      return metaMap[`og:${field}`] || metaMap[field] || '';
    };

    // --- (7) Lấy title/description/image ---
    const title =
      getMeta('title') || $('head title').text().trim() || parsedUrl.href;
    const description = getMeta('description');
    const image = getMeta('image');

    const result = {
      title,
      description,
      image,
      url: parsedUrl.href,
    };

    // --- (8) Lưu vào cache ---
    cache.set(parsedUrl.href, {
      data: result,
      timestamp: Date.now(),
    });

    return res.json(result);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }
    console.error('Error fetching URL:', err);
    return res.status(500).json({ error: 'Lỗi khi fetch URL' });
  }
});

module.exports = router;
