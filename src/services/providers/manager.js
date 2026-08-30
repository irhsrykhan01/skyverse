import { createDepayProvider } from './depay.js';
import { createKeyraDownloaderProvider } from './keyra-downloaders.js';
import { createRemoveBgProvider } from './removebg.js';

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

  // Keyra remains primary for TikTok/YouTube. Depay is used as an automatic
  // fallback so a temporary provider outage does not break the command.
  const downloader = Object.freeze({
    ...keyraDownloader,
    tiktok: (url) => withFallback(
      () => keyraDownloader.tiktok(url),
      () => depay.tiktok(url),
    ),
    youtube: (url) => withFallback(
      () => keyraDownloader.youtube(url),
      () => depay.youtube(url, 'video'),
    ),
    youtubeMp3: (url) => withFallback(
      () => keyraDownloader.youtubeMp3(url),
      () => depay.youtube(url, 'mp3'),
    ),
    facebook: depay.facebook,
  });

  const removebg = createRemoveBgProvider({
    baseUrl: config.removeBgBaseUrl,
  });

  return Object.freeze({
    depay,
    downloader,
    removebg,
  });
}
