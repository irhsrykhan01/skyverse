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
  youtube: process.env.SKYVERSE_TEST_YOUTUBE_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  instagram: process.env.SKYVERSE_TEST_INSTAGRAM_URL || '',
  facebook: process.env.SKYVERSE_TEST_FACEBOOK_URL || '',
  pinterest: process.env.SKYVERSE_TEST_PINTEREST_URL || '',
  twitter: process.env.SKYVERSE_TEST_TWITTER_URL || '',
  mediafire: process.env.SKYVERSE_TEST_MEDIAFIRE_URL || '',
  gdrive: process.env.SKYVERSE_TEST_GDRIVE_URL || '',
};

const deline = createDelineProvider({ baseUrl: config.delineBaseUrl });
const zenzxz = createZenzxzProvider({ baseUrl: config.zenzxzBaseUrl });
const siputzx = createSiputzxProvider({ baseUrl: config.siputzxBaseUrl });
const vreden = createVredenProvider({ baseUrl: config.vredenBaseUrl });
const tikwm = createTikwmProvider({ baseUrl: config.tikwmBaseUrl });
const reelsvideo = createReelsVideoProvider({ baseUrl: config.reelsVideoBaseUrl });

let passed = 0;
let failed = 0;
let skipped = 0;

function mediaCount(response, kinds = ['video', 'image', 'audio']) {
  return kinds.reduce((total, kind) => total + findDownloaderUrls(response, { kind }).length, 0);
}

async function check(label, platform, url, run, validate = (value) => mediaCount(value) > 0) {
  if (!url) {
    skipped += 1;
    console.log('[SKIP] ' + label + ' — set SKYVERSE_TEST_' + platform.toUpperCase() + '_URL to test this platform.');
    return;
  }
  try {
    const response = await run(url);
    if (!validate(response)) throw new Error('API responded but no usable media URL was found in its response.');
    passed += 1;
    console.log('[OK]   ' + label + ' — API response contains media URL(s).');
  } catch (error) {
    failed += 1;
    console.log('[FAIL] ' + label + ' — ' + String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 260));
  }
}

await check('TikTok / TikWM', 'tiktok', urls.tiktok, (url) => tikwm.tiktok(url));
await check('TikTok / Deline', 'tiktok', urls.tiktok, (url) => deline.call('/downloader/tiktok', { url }));
await check('TikTok / Zenzxz', 'tiktok', urls.tiktok, (url) => zenzxz.call('/downloader/tiktok', { url }));

await check('YouTube video / Siputzx', 'youtube', urls.youtube, (url) => siputzx.youtube(url), (response) =>
  mediaCount(response, ['video']) > 0 || Boolean(findMediaSource(response?.result ?? response, { baseUrl: config.siputzxBaseUrl }))
);
await check('YouTube video / Deline', 'youtube', urls.youtube, (url) => deline.youtube(url));
await check('YouTube video / Zenzxz', 'youtube', urls.youtube, (url) => zenzxz.youtube(url));
await check('YouTube video / Vreden', 'youtube', urls.youtube, (url) => vreden.youtube(url));

await check('YouTube MP3 / Siputzx', 'youtube', urls.youtube, (url) => siputzx.youtubeMp3(url));
await check('YouTube MP3 / Deline', 'youtube', urls.youtube, (url) => deline.youtubeMp3(url));
await check('YouTube MP3 / Zenzxz', 'youtube', urls.youtube, (url) => zenzxz.youtubeMp3(url));
await check('YouTube MP3 / Vreden', 'youtube', urls.youtube, (url) => vreden.youtubeMp3(url));

await check('Instagram / ReelsVideo', 'instagram', urls.instagram, (url) => reelsvideo.instagram(url), (response) =>
  Boolean(response?.result?.videos?.length || response?.result?.images?.length || response?.result?.audio?.length)
);
await check('Facebook / Deline', 'facebook', urls.facebook, (url) => deline.facebook(url));
await check('Facebook / Zenzxz', 'facebook', urls.facebook, (url) => zenzxz.facebook(url));
await check('Pinterest / Deline', 'pinterest', urls.pinterest, (url) => deline.pinterest(url));
await check('Twitter/X / Deline', 'twitter', urls.twitter, (url) => deline.twitter(url));
await check('MediaFire / Deline', 'mediafire', urls.mediafire, (url) => deline.mediafire(url), (response) =>
  Boolean(findMediaSource(response?.result ?? response, { baseUrl: config.delineBaseUrl }))
);
await check('Google Drive / Deline', 'gdrive', urls.gdrive, (url) => deline.googleDrive(url), (response) =>
  Boolean(findMediaSource(response?.result ?? response, { baseUrl: config.delineBaseUrl }))
);

console.log('');
console.log('Downloader API checks: ' + passed + ' OK, ' + failed + ' failed, ' + skipped + ' skipped.');
console.log('This checks provider responses and URL extraction only; it does not download or send media.');
if (failed > 0) process.exitCode = 1;
