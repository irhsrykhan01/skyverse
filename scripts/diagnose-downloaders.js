import 'dotenv/config';
import { loadConfig } from '../src/config/env.js';
import { createDelineProvider } from '../src/services/providers/deline.js';
import { createZenzxzProvider } from '../src/services/providers/zenzxz.js';
import { createSiputzxProvider } from '../src/services/providers/siputzx.js';
import { createVredenProvider } from '../src/services/providers/vreden.js';
import { createTikwmProvider } from '../src/services/providers/tikwm.js';
import { createReelsVideoProvider } from '../src/services/providers/reelsvideo.js';
import { findDownloaderUrls } from '../src/services/providers/downloader-response.js';
import { findMediaSource } from '../src/services/providers/media-response.js';

const config = loadConfig();
const urls = {
  tiktok: process.env.SKYVERSE_TEST_TIKTOK_URL || 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
  youtube: process.env.SKYVERSE_TEST_YOUTUBE_URL || 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  instagram: process.env.SKYVERSE_TEST_INSTAGRAM_URL || '',
  facebook: process.env.SKYVERSE_TEST_FACEBOOK_URL || '',
  pinterest: process.env.SKYVERSE_TEST_PINTEREST_URL || '',
  twitter: process.env.SKYVERSE_TEST_TWITTER_URL || '',
  mediafire: process.env.SKYVERSE_TEST_MEDIAFIRE_URL || '',
  gdrive: process.env.SKYVERSE_TEST_GDRIVE_URL || '',
};

const deline = createDelineProvider({ baseUrl: config.delineBaseUrl, apiKey: config.delineApiKey });
const zenzxz = createZenzxzProvider({ baseUrl: config.zenzxzBaseUrl });
const siputzx = createSiputzxProvider({ baseUrl: config.siputzxBaseUrl });
const vreden = createVredenProvider({ baseUrl: config.vredenBaseUrl });
const tikwm = createTikwmProvider({ baseUrl: config.tikwmBaseUrl });
const reelsvideo = createReelsVideoProvider({ baseUrl: config.reelsVideoBaseUrl });

let passed = 0;
let failed = 0;
let skipped = 0;

function candidates(response, kinds, baseUrl) {
  const result = [];
  for (const kind of kinds) result.push(...findDownloaderUrls(response, { kind }));
  const source = findMediaSource(response?.result ?? response, { baseUrl: baseUrl ?? config.delineBaseUrl });
  if (source?.kind === 'url') result.push(source.value);
  return [...new Set(result.filter((value) => typeof value === 'string' && /^https?:\/\//i.test(value)))];
}

async function probeMediaUrl(url) {
  const response = await fetch(url, {
    headers: { accept: 'image/*,video/*,audio/*,application/octet-stream;q=0.9,*/*;q=0.8', range: 'bytes=0-2047' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('media URL HTTP ' + response.status);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const reader = response.body?.getReader();
  const first = reader ? await reader.read() : { value: null };
  if (reader) await reader.cancel().catch(() => {});
  const prefix = first.value ? Buffer.from(first.value).subarray(0, 32).toString('utf8').trimStart().toLowerCase() : '';
  if (!first.value?.length) throw new Error('media URL returned an empty body');
  if (contentType.includes('text/html') || contentType.includes('application/json') || prefix.startsWith('<!doctype html') || prefix.startsWith('<html') || prefix.startsWith('{')) {
    throw new Error('media URL returned a web page or JSON, not a media file');
  }
}

async function check(label, platform, url, run, kinds = ['video', 'image', 'audio'], baseUrl = null, custom = null) {
  if (!url) {
    skipped += 1;
    console.log('[SKIP] ' + label + ' — set SKYVERSE_TEST_' + platform.toUpperCase() + '_URL to test this platform.');
    return;
  }

  let response;
  try {
    response = await run(url);
  } catch (error) {
    failed += 1;
    console.log('[API FAIL] ' + label + ' — ' + String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 240));
    return;
  }

  const urlsToProbe = custom ? custom(response) : candidates(response, kinds, baseUrl);
  if (!urlsToProbe.length) {
    failed += 1;
    console.log('[PARSER FAIL] ' + label + ' — API responded but SkyVerse could not extract a media URL.');
    return;
  }

  const errors = [];
  for (const mediaUrl of urlsToProbe.slice(0, 3)) {
    try {
      await probeMediaUrl(mediaUrl);
      passed += 1;
      console.log('[OK] ' + label + ' — API response and media URL are reachable.');
      return;
    } catch (error) {
      errors.push(String(error?.message ?? error));
    }
  }

  failed += 1;
  console.log('[MEDIA FAIL] ' + label + ' — API returned URL(s), but media fetch failed: ' + errors.join(' | ').slice(0, 220));
}

await check('TikTok / TikWM', 'tiktok', urls.tiktok, (url) => tikwm.tiktok(url), ['video', 'image', 'audio']);
await check('TikTok / Deline', 'tiktok', urls.tiktok, (url) => deline.call('/downloader/tiktok', { url }), ['video', 'image', 'audio']);
await check('TikTok / Zenzxz', 'tiktok', urls.tiktok, (url) => zenzxz.call('/downloader/tiktok', { url }), ['video', 'image', 'audio']);

await check('YouTube video / Siputzx', 'youtube', urls.youtube, (url) => siputzx.youtube(url), ['video'], config.siputzxBaseUrl);
await check('YouTube video / Deline', 'youtube', urls.youtube, (url) => deline.youtube(url), ['video']);
await check('YouTube video / Zenzxz', 'youtube', urls.youtube, (url) => zenzxz.youtube(url), ['video']);
await check('YouTube video / Vreden', 'youtube', urls.youtube, (url) => vreden.youtube(url), ['video']);

await check('YouTube MP3 / Siputzx', 'youtube', urls.youtube, (url) => siputzx.youtubeMp3(url), ['audio', 'video']);
await check('YouTube MP3 / Deline', 'youtube', urls.youtube, (url) => deline.youtubeMp3(url), ['audio', 'video']);
await check('YouTube MP3 / Zenzxz', 'youtube', urls.youtube, (url) => zenzxz.youtubeMp3(url), ['audio', 'video']);
await check('YouTube MP3 / Vreden', 'youtube', urls.youtube, (url) => vreden.youtubeMp3(url), ['audio', 'video']);

await check('Instagram / ReelsVideo', 'instagram', urls.instagram, (url) => reelsvideo.instagram(url), ['video', 'image', 'audio'], config.reelsVideoBaseUrl, (response) => [
  ...(response?.result?.videos ?? []),
  ...(response?.result?.images ?? []),
  ...(response?.result?.audio ?? []),
]);

await check('Facebook / Deline', 'facebook', urls.facebook, (url) => deline.facebook(url), ['video']);
await check('Facebook / Zenzxz', 'facebook', urls.facebook, (url) => zenzxz.facebook(url), ['video']);
await check('Pinterest / Deline', 'pinterest', urls.pinterest, (url) => deline.pinterest(url), ['video', 'image']);
await check('Twitter/X / Deline', 'twitter', urls.twitter, (url) => deline.twitter(url), ['video', 'image']);
await check('MediaFire / Deline', 'mediafire', urls.mediafire, (url) => deline.mediafire(url), [], config.delineBaseUrl);
await check('Google Drive / Deline', 'gdrive', urls.gdrive, (url) => deline.googleDrive(url), [], config.delineBaseUrl);

console.log('');
console.log('Downloader checks: ' + passed + ' OK, ' + failed + ' failed, ' + skipped + ' skipped.');
console.log('API FAIL = provider request; PARSER FAIL = response format; MEDIA FAIL = returned URL cannot be fetched.');
console.log('This diagnostic does not send files to WhatsApp.');
if (failed > 0) process.exitCode = 1;
