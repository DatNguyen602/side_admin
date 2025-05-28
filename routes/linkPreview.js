const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const router = express.Router();

router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(400).json({ error: 'Failed to fetch URL' });

    const html = await response.text();
    const $ = cheerio.load(html);

    const getMeta = (name) =>
      $(`meta[property='og:${name}']`).attr('content') ||
      $(`meta[name='${name}']`).attr('content') ||
      '';

    const title = getMeta('title') || $('title').text() || url;
    const description = getMeta('description') || '';
    const image = getMeta('image') || '';

    res.json({ title, description, image, url });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching URL' });
  }
});

module.exports = router;
