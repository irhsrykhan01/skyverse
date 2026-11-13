import 'dotenv/config';
import { loadConfig } from '../src/config/env.js';
import { createTikwmProvider } from '../src/services/providers/tikwm.js';
import { createYtDlpProvider } from '../src/services/providers/ytdlp.js';
import { createSairiHostDownloaderProvider } from '../src/services/providers/sairihost-downloaders.js';
import { findDownloaderUrls } from '../src/services/providers/downloader-response.js';

const config = loadConfig();
const urls = {
  tiktok: process.env.SKYVERSE_TEST_TIKTOK_URL || 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
  youtube: process.env.SKYVERSE_TEST_YOUTUBE_URL || 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  youtubeShorts: process.env.SKYVERSE_TEST_YOUTUBE_SHORTS_URL || '',
  instagram: process.env.SKYVERSE_TEST_INSTAGRAM_URL || '',
};
const tikwm = createTikwmProvider({ baseUrl: config.tikwmBaseUrl });
const ytdlp = createYtDlpProvider({ binaryPath: config.ytDlpPath });
const sairiHostDownloader = createSairiHostDownloaderProvider({
  baseUrl: config.sairiHostBaseUrl,
  apiKey: config.sairiHostApiKey,
});
let passed = 0;
let failed = 0;
let skipped = 0;

function describeError(error) {
  return String(error?.message ?? error).replace(/\\s+/g, ' ').slice(0, 300);
}

function isVideoBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
  return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    || buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    || buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
}

function isImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
  return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    || buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    || (buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP');
}

async function probeMediaUrl(url, kind = 'video') {
  const response = await fetch(url, {
    headers: {
      accept: kind === 'image' ? 'image/*,*/*;q=0.8' : 'video/*,audio/*,*/*;q=0.8',
      range: 'bytes=0-2047',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('media URL HTTP ' + response.status);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const reader = response.body?.getReader();
  const first = reader ? await reader.read() : { value: null };
  if (reader) await reader.cancel().catch(() => {});
  if (!first.value?.length) throw new Error('media URL returned an empty body');
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    throw new Error('media URL returned HTML/JSON, not media');
  }
}

async function validateTikTokResponse(response) {
  const result = response?.result ?? response?.data ?? response ?? {};
  if (Buffer.isBuffer(result.buffer)) {
    if (!isVideoBuffer(result.buffer)) throw new Error('provider returned an invalid video buffer');
    return 'video buffer valid';
  }

  const videoUrl = findDownloaderUrls(response, { kind: 'video' })[0];
  if (videoUrl) {
    await probeMediaUrl(videoUrl, 'video');
    return 'video URL reachable';
  }

  const images = Array.isArray(result.images) && result.images.length
    ? result.images.filter((value) => typeof value === 'string' && /^https?:\\/\\//i.test(value))
    : findDownloaderUrls(response, { kind: 'image' });
  if (images.length) {
    await probeMediaUrl(images[0], 'image');
    return 'photo URL reachable';
  }

  throw new Error('provider returned no usable video buffer or media URL');
}

async function checkTikTok() {
  const attempts = [
    { name: 'TikWM', run: () => tikwm.tiktok(urls.tiktok) },
    { name: 'yt-dlp fallback', run: () => ytdlp.tiktok(urls.tiktok) },
  ];
  if (config.sairiHostDownloaderEnabled && config.sairiHostApiKey) {
    attempts.push({ name: 'SairiHost fallback', run: () => sairiHostDownloader.tiktok(urls.tiktok) });
  } else {
    skipped += 1;
    console.log('[SKIP] TikTok / SairiHost — optional provider disabled or API key not configured.');
  }

  const errors = [];
  for (const attempt of attempts) {
    try {
      const response = await attempt.run();
      const detail = await validateTikTokResponse(response);
      passed += 1;
      console.log('[OK] TikTok / ' + attempt.name + ' — ' + detail + '.');
      return;
    } catch (error) {
      errors.push(attempt.name + ': ' + describeError(error));
      console.log('[WARN] TikTok / ' + attempt.name + ' — ' + describeError(error));
    }
  }

  failed += 1;
  console.log('[FAIL] TikTok — seluruh provider pada fallback chain gagal. ' + errors.join(' | '));
}

async function checkUrl(label, url, run, optional = false) {
  if (!url) {
    if (optional) {
      skipped += 1;
      console.log('[SKIP] ' + label + ' — set the matching SKYVERSE_TEST_*_URL to test.');
    } else {
      failed += 1;
      console.log('[FAIL] ' + label + ' — test URL is missing.');
    }
    return;
  }

  try {
    const response = await run(url);
    const mediaUrl = findDownloaderUrls(response, { kind: 'video' })[0];
    if (!mediaUrl) throw new Error('SkyVerse could not extract a video URL.');
    await probeMediaUrl(mediaUrl, 'video');
    passed += 1;
    console.log('[OK] ' + label + ' — media URL is reachable.');
  } catch (error) {
    failed += 1;
    console.log('[FAIL] ' + label + ' — ' + describeError(error));
  }
}

let ytDlpAvailable = false;
try {
  console.log('[INFO] yt-dlp ' + await ytdlp.version());
  ytDlpAvailable = true;
} catch (error) {
  failed += 1;
  console.log('[FAIL] yt-dlp executable — ' + describeError(error));
}

await checkTikTok();
if (ytDlpAvailable) {
  await checkUrl('YouTube video / yt-dlp', urls.youtube, (url) => ytdlp.youtube(url));
  await checkUrl('YouTube Shorts / yt-dlp', urls.youtubeShorts, (url) => ytdlp.youtube(url), true);
  await checkUrl('Instagram Reel / yt-dlp', urls.instagram, (url) => ytdlp.instagram(url), true);
} else {
  failed += 1;
  console.log('[FAIL] YouTube / yt-dlp and Instagram / yt-dlp — cannot test without yt-dlp executable.');
}

console.log('');
console.log('Downloader checks: ' + passed + ' OK, ' + failed + ' failed, ' + skipped + ' skipped.');
console.log('MP3 conversion is local through FFmpeg and is covered by npm run diagnose-media.');
if (failed > 0) process.exitCode = 1;
