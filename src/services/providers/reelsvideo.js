import { createHash } from 'node:crypto';
import { requestResource } from './http.js';

function decodeHtml(value) {
  return String(value ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x2F;', '/')
    .replaceAll('&#47;', '/')
    .replaceAll('&quot;', '"');
}

function hrefsByClass(html, className) {
  const out = [];
  const anchor = /<a\b[^>]*>/gi;
  for (const tag of String(html).match(anchor) ?? []) {
    const cls = /class=["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
    if (!cls.split(/\s+/).includes(className)) continue;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (href) out.push(decodeHtml(href));
  }
  return out;
}

export function createReelsVideoProvider({ baseUrl = 'https://reelsvideo.io' } = {}) {
  async function instagram(url) {
    const ts = Math.floor(Date.now() / 1000);
    const token = createHash('md5').update(`${ts}X-Fc-Pp-Ty-eZ`).digest('hex');
    const endpoint = `${String(baseUrl).replace(/\/+$/, '')}/reel/DUU67gXiTwU/?igsh=MTZxdm1yd3pnN3Rvdg==/`;
    const html = await requestResource(endpoint, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'hx-request': 'true',
        'hx-current-url': `${String(baseUrl).replace(/\/+$/, '')}/`,
        'hx-target': 'target',
        origin: String(baseUrl).replace(/\/+$/, ''),
        referer: `${String(baseUrl).replace(/\/+$/, '')}/`,
        'user-agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/139 Mobile Safari/537.36',
      },
      body: new URLSearchParams({
        id: url,
        locale: 'en',
        'cf-turnstile-response': '',
        tt: token,
        ts: String(ts),
      }),
      retries: 1,
      timeout: 45_000,
    });
    if (typeof html !== 'string') throw new Error('ReelsVideo mengembalikan response yang tidak valid.');
    const videos = hrefsByClass(html, 'type_videos');
    const images = hrefsByClass(html, 'type_images');
    const audio = hrefsByClass(html, 'type_audio');
    if (!videos.length && !images.length && !audio.length) throw new Error('ReelsVideo tidak menemukan media Instagram.');
    return { result: { videos, images, audio } };
  }
  return Object.freeze({ instagram });
}
