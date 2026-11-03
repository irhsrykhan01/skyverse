import 'dotenv/config';
import { loadConfig } from '../src/config/env.js';
import { createTikwmProvider } from '../src/services/providers/tikwm.js';
import { createYtDlpProvider } from '../src/services/providers/ytdlp.js';
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
let passed = 0, failed = 0, skipped = 0;

async function probeMediaUrl(url) {
  const response = await fetch(url, {
    headers: { accept: 'video/*,audio/*,*/*;q=0.8', range: 'bytes=0-2047' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('media URL HTTP ' + response.status);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const reader = response.body?.getReader();
  const first = reader ? await reader.read() : { value: null };
  if (reader) await reader.cancel().catch(() => {});
  if (!first.value?.length) throw new Error('media URL returned an empty body');
  if (contentType.includes('text/html') || contentType.includes('application/json')) throw new Error('media URL returned HTML/JSON, not media');
}

async function check(label, url, run, optional = false) {
  if (!url) {
    if (optional) { skipped += 1; console.log('[SKIP] ' + label + ' — set the matching SKYVERSE_TEST_*_URL to test.'); }
    else { failed += 1; console.log('[FAIL] ' + label + ' — test URL is missing.'); }
    return;
  }
  try {
    const response = await run(url);
    const mediaUrl = findDownloaderUrls(response, { kind: 'video' })[0];
    if (!mediaUrl) throw new Error('SkyVerse could not extract a video URL.');
    await probeMediaUrl(mediaUrl);
    passed += 1;
    console.log('[OK] ' + label + ' — media URL is reachable.');
  } catch (error) {
    failed += 1;
    console.log('[FAIL] ' + label + ' — ' + String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 300));
  }
}

try { console.log('[INFO] yt-dlp ' + await ytdlp.version()); }
catch (error) { failed += 1; console.log('[FAIL] yt-dlp executable — ' + String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 300)); }

await check('TikTok / TikWM', urls.tiktok, (url) => tikwm.tiktok(url));
await check('YouTube video / yt-dlp', urls.youtube, (url) => ytdlp.youtube(url));
await check('YouTube Shorts / yt-dlp', urls.youtubeShorts, (url) => ytdlp.youtube(url), true);
await check('Instagram Reel / yt-dlp', urls.instagram, (url) => ytdlp.instagram(url), true);

console.log('');
console.log('Downloader checks: ' + passed + ' OK, ' + failed + ' failed, ' + skipped + ' skipped.');
console.log('MP3 conversion is local through FFmpeg and is not tested by this network diagnostic.');
if (failed > 0) process.exitCode = 1;
