import {
  downloadMediaFromResponse,
  downloadWithProviderFallback,
  findDownloaderUrl,
  findDownloaderUrls,
  isLikelyMediaBuffer,
} from '../services/providers/downloader-response.js';
import { normalizeTikTokUrl } from '../services/providers/tiktok-url.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createMp4() {
  const buffer = Buffer.alloc(32);
  buffer.write('ftyp', 4, 'ascii');
  return buffer;
}

function createMp3() {
  const buffer = Buffer.alloc(32);
  buffer.write('ID3', 0, 'ascii');
  return buffer;
}

const shortUrl = normalizeTikTokUrl('https://vt.tiktok.com/ZSpnRFAsk/');
assert(shortUrl === 'https://vt.tiktok.com/ZSpnRFAsk/', 'TikTok short URL normalization regression.');
assert(normalizeTikTokUrl('www.tiktok.com/@creator/video/123').startsWith('https://'), 'TikTok URL without a scheme was not normalized.');
let rejectedHost = false;
try { normalizeTikTokUrl('https://tiktok.com.example.org/video/123'); } catch { rejectedHost = true; }
assert(rejectedHost, 'Non-TikTok host was accepted.');

const response = {
  status: true,
  result: { download_url: 'https://cdn.example/video.mp4' },
  thumbnail: 'https://cdn.example/thumbnail.jpg',
  author: {
    avatar: 'https://cdn.example/avatar.jpeg',
    audio_url: 'https://cdn.example/audio.mp3',
  },
};
assert(findDownloaderUrl(response, { kind: 'video' }) === response.result.download_url, 'Video URL selection chose a thumbnail/avatar.');
assert(findDownloaderUrl(response, { kind: 'audio' }) === response.author.audio_url, 'Audio URL outside the result envelope was not found.');
assert(findDownloaderUrls(response, { kind: 'video' }).length === 1, 'Video candidates include non-video resources.');

const mp4 = createMp4();
const mp3 = createMp3();
assert(isLikelyMediaBuffer(mp4, 'video'), 'MP4 signature was rejected.');
assert(isLikelyMediaBuffer(mp3, 'audio'), 'MP3 signature was rejected.');
assert(!isLikelyMediaBuffer(Buffer.from('<html>not media bytes</html>'), 'video'), 'HTML was accepted as video media.');
assert((await downloadMediaFromResponse({ media: mp4 }, { kind: 'video' })).equals(mp4), 'Direct provider media buffer was not handled.');

const fallbackResult = await downloadWithProviderFallback([
  {
    name: 'Keyra',
    execute: async () => { throw Object.assign(new Error('HTTP 403'), { status: 403 }); },
  },
  {
    name: 'TikTok Worker',
    execute: async () => ({ download_url: 'https://cdn.example/video.mp4' }),
  },
], shortUrl, {
  kind: 'video',
  downloadResponse: async () => mp4,
});
assert(fallbackResult.provider === 'TikTok Worker', 'Fallback did not advance after the primary provider failed.');
assert(fallbackResult.buffer.equals(mp4), 'Fallback did not return the validated media buffer.');

const mediaFallbackResult = await downloadWithProviderFallback([
  { name: 'Keyra', execute: async () => ({ download_url: 'https://cdn.example/broken.mp4' }) },
  { name: 'Depay', execute: async () => ({ download_url: 'https://cdn.example/working.mp4' }) },
], shortUrl, {
  kind: 'video',
  downloadResponse: async (body) => {
    if (body.download_url.includes('broken')) throw new Error('CDN HTTP 403');
    return mp4;
  },
});
assert(mediaFallbackResult.provider === 'Depay', 'Fallback did not advance after the media CDN failed.');

let aggregatedError = '';
try {
  await downloadWithProviderFallback([
    { name: 'Keyra', execute: async () => { throw new Error('HTTP 403'); } },
    { name: 'Depay', execute: async () => { throw new Error('HTTP 502'); } },
  ], shortUrl, { kind: 'video', downloadResponse: async () => mp4 });
} catch (error) {
  aggregatedError = error.message;
}
assert(aggregatedError.includes('Keyra') && aggregatedError.includes('Depay'), 'Provider failure details were not preserved.');

console.log('SkyVerse downloader tests passed: TikTok URL validation, media URL ranking, media signatures, provider fallback, CDN fallback, and aggregated errors.');
