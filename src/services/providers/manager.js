import { createDepayProvider } from './depay.js';
import { createKeyraDownloaderProvider } from './keyra-downloaders.js';
import { createMakerProvider } from './makers.js';
import { createRemoveBgProvider } from './removebg.js';
import { createPublicDownloaderProvider } from './public-downloader.js';

async function withFallback(primary, fallback) {
  try {
    return await primary();
  } catch (primaryError) {
    try {
      return await fallback();
    } catch (fallbackError) {
      const error = new Error(fallbackError?.message ?? primaryError?.message ?? 'Semua provider gagal.');
      error.cause = { primary: primaryError, fallback: fallbackError };
      throw error;
    }
  }
}

export function createProviderManager(config) {
  const depay = createDepayProvider({
    baseUrl: config.depayBaseUrl,
  });

  const keyraDownloader = createKeyraDownloaderProvider({
    apiKey: config.keyraApiKey,
    baseUrl: config.keyraBaseUrl,
  });

  const publicDownloader = createPublicDownloaderProvider();

  const makers = createMakerProvider({
    bratBaseUrl: config.bratBaseUrl,
    nexrayBaseUrl: config.nexrayBaseUrl,
  });

  // Keyra remains primary for TikTok/YouTube. Depay is used as an automatic
  // fallback so a temporary provider outage does not break the command.
  const downloader = Object.freeze({
    ...keyraDownloader,
    tiktok: (url) => withFallback(
      () => keyraDownloader.tiktok(url),
      () => withFallback(() => depay.tiktok(url), () => publicDownloader.tiktok(url)),
    ),
    youtube: (url) => withFallback(
      () => keyraDownloader.youtube(url),
      () => withFallback(() => depay.youtube(url, 'video'), () => publicDownloader.youtube(url)),
    ),
    youtubeMp3: (url) => withFallback(
      () => keyraDownloader.youtubeMp3(url),
      () => withFallback(() => depay.youtube(url, 'mp3'), () => publicDownloader.youtubeMp3(url)),
    ),
    instagram: (url) => withFallback(() => keyraDownloader.instagram(url), () => publicDownloader.instagram(url)),
    pinterest: publicDownloader.pinterest,
    capcut: publicDownloader.capcut,
    twitter: publicDownloader.twitter,
    mediafire: publicDownloader.mediafire,
    allInOne: publicDownloader.allInOne,
    facebook: depay.facebook,
  });

  const removebg = createRemoveBgProvider({
    baseUrl: config.removeBgBaseUrl,
  });

  return Object.freeze({
    depay,
    makers,
    downloader,
    removebg,
  });
}
