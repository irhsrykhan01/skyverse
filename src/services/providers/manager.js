import { createDelineProvider } from './deline.js';
import { createMakerProvider } from './makers.js';
import { createReelsVideoProvider } from './reelsvideo.js';
import { createRemoveBgProvider } from './removebg.js';
import { createSiputzxProvider } from './siputzx.js';
import { findDownloaderUrl } from './downloader-response.js';
import { createTikwmProvider } from './tikwm.js';
import { createYtDlpProvider } from './ytdlp.js';
import { createVredenProvider } from './vreden.js';
import { createZenzxzProvider } from './zenzxz.js';
import { createSairiHostMakerProvider } from './sairihost-makers.js';

function describeError(error) {
  return String(error?.message ?? error ?? 'Unknown provider error').replace(/\s+/g, ' ').trim();
}

async function withFallbackChain(providers) {
  const errors = [];
  for (const { name, run } of providers) {
    try {
      return await run();
    } catch (error) {
      errors.push({ provider: name, error });
    }
  }

  const details = errors
    .map(({ provider, error }) => `${provider}: ${describeError(error)}`)
    .join(' | ');
  const error = new Error(details ? `Semua provider gagal — ${details}` : 'Tidak ada provider yang dikonfigurasi.');
  error.cause = errors.map(({ provider, error: cause }) => ({ provider, message: describeError(cause) }));
  throw error;
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function normalizeTikTokResponse(response, providerName) {
  const resultValue = response?.result ?? response?.data ?? response;
  const result = resultValue && typeof resultValue === 'object' && !Array.isArray(resultValue)
    ? resultValue
    : {};
  const images = Array.isArray(result.images) ? result.images.filter(isHttpUrl) : [];
  const directVideo = [
    result.video,
    result.play,
    result.video_url,
    result.videoUrl,
    result.hdplay,
    result.wmplay,
    result.nowm,
    result.no_watermark,
  ].find(isHttpUrl);
  const video = directVideo ?? findDownloaderUrl(response, { kind: 'video' });

  if (!video && images.length === 0) {
    throw new Error(`${providerName} tidak mengembalikan URL video/foto TikTok yang dapat digunakan.`);
  }

  return {
    ...(response && typeof response === 'object' ? response : {}),
    result: { ...result, video: video ?? null, images },
  };
}

function requireDownloaderMedia(response, providerName, kinds) {
  const hasMedia = kinds.some((kind) => Boolean(findDownloaderUrl(response, { kind })));
  if (!hasMedia) {
    throw new Error(`${providerName} tidak mengembalikan URL media yang dikenali.`);
  }
  return response;
}

export function createProviderManager(config) {
  const deline = createDelineProvider({ baseUrl: config.delineBaseUrl, apiKey: config.delineApiKey });
  const zenzxz = createZenzxzProvider({ baseUrl: config.zenzxzBaseUrl });
  const sairiHostMakers = createSairiHostMakerProvider({ baseUrl: config.sairiHostBaseUrl, apiKey: config.sairiHostApiKey });
  const vreden = createVredenProvider({ baseUrl: config.vredenBaseUrl });
  const siputzx = createSiputzxProvider({ baseUrl: config.siputzxBaseUrl });
  const tikwm = createTikwmProvider({ baseUrl: config.tikwmBaseUrl });
  const ytdlp = createYtDlpProvider({ binaryPath: config.ytDlpPath });
  const reelsvideo = createReelsVideoProvider({ baseUrl: config.reelsVideoBaseUrl });

  const makers = createMakerProvider({
    bratBaseUrl: config.bratBaseUrl,
    delineBaseUrl: config.delineBaseUrl,
    zenzxzBaseUrl: config.zenzxzBaseUrl,
    nexrayBaseUrl: config.nexrayBaseUrl,
    deline,
    zenzxz,
  });

  const downloader = Object.freeze({
    tiktok: async (url) => normalizeTikTokResponse(await tikwm.tiktok(url), 'TikWM'),
    instagram: (url) => ytdlp.instagram(url),
    youtube: (url) => ytdlp.youtube(url),
    youtubeMp3: (url) => ytdlp.youtube(url),
    facebook: (url) => withFallbackChain([
      { name: 'Deline', run: async () => requireDownloaderMedia(await deline.facebook(url), 'Deline', ['video']) },
      { name: 'Zenzxz', run: async () => requireDownloaderMedia(await zenzxz.facebook(url), 'Zenzxz', ['video']) },
    ]),
    pinterest: (url) => deline.pinterest(url),
    twitter: (url) => deline.twitter(url),
    mediafire: (url) => deline.mediafire(url),
    googleDrive: (url) => deline.googleDrive(url),
  });

  const removebg = createRemoveBgProvider({ baseUrl: config.removeBgBaseUrl });

  return Object.freeze({
    deline,
    zenzxz,
    vreden,
    siputzx,
    tikwm,
    ytdlp,
    reelsvideo,
    makers,
    sairiHostMakers,
    downloader,
    removebg,
  });
}
