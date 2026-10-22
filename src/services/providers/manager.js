import { createDepayProvider } from './depay.js';
import { createDelineProvider } from './deline.js';
import { createMakerProvider } from './makers.js';
import { createReelsVideoProvider } from './reelsvideo.js';
import { createRemoveBgProvider } from './removebg.js';
import { createTikwmProvider } from './tikwm.js';
import { createVredenProvider } from './vreden.js';
import { createZenzxzProvider } from './zenzxz.js';

async function withFallbackChain(providers) {
  const errors = [];
  for (const provider of providers) {
    try {
      return await provider();
    } catch (error) {
      errors.push(error);
    }
  }
  const error = new Error(errors.at(-1)?.message ?? 'Semua provider gagal.');
  error.cause = errors;
  throw error;
}

export function createProviderManager(config) {
  const depay = createDepayProvider({ baseUrl: config.depayBaseUrl });
  const deline = createDelineProvider({ baseUrl: config.delineBaseUrl });
  const zenzxz = createZenzxzProvider({ baseUrl: config.zenzxzBaseUrl });
  const vreden = createVredenProvider({ baseUrl: config.vredenBaseUrl });
  const tikwm = createTikwmProvider({ baseUrl: config.tikwmBaseUrl });
  const reelsvideo = createReelsVideoProvider({ baseUrl: config.reelsVideoBaseUrl });

  const makers = createMakerProvider({
    bratBaseUrl: config.bratBaseUrl,
    nexrayBaseUrl: config.nexrayBaseUrl,
    deline,
    zenzxz,
  });

  const downloader = Object.freeze({
    tiktok: (url) => tikwm.tiktok(url),
    instagram: (url) => reelsvideo.instagram(url),
    youtube: (url) => withFallbackChain([
      () => deline.youtube(url),
      () => zenzxz.youtube(url),
      () => vreden.youtube(url),
      () => depay.youtube(url, 'video'),
    ]),
    youtubeMp3: (url) => withFallbackChain([
      () => deline.youtubeMp3(url),
      () => zenzxz.youtubeMp3(url),
      () => vreden.youtubeMp3(url),
      () => depay.youtube(url, 'mp3'),
    ]),
    facebook: (url) => withFallbackChain([
      () => deline.facebook(url),
      () => zenzxz.facebook(url),
      () => depay.facebook(url),
    ]),
    pinterest: (url) => deline.pinterest(url),
    twitter: (url) => deline.twitter(url),
    mediafire: (url) => deline.mediafire(url),
    googleDrive: (url) => deline.googleDrive(url),
  });

  const removebg = createRemoveBgProvider({ baseUrl: config.removeBgBaseUrl });

  return Object.freeze({
    depay,
    deline,
    zenzxz,
    vreden,
    tikwm,
    reelsvideo,
    makers,
    downloader,
    removebg,
  });
}
