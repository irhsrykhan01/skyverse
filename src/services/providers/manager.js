import { createMakerProvider } from './makers.js';
import { createRemoveBgProvider } from './removebg.js';
import { createPublicDownloaderProvider } from './public-downloader.js';

export function createProviderManager(config) {
  const makers = createMakerProvider({
    bratBaseUrl: config.bratBaseUrl,
    nexrayBaseUrl: config.nexrayBaseUrl,
  });

  const downloader = createPublicDownloaderProvider();

  const removebg = createRemoveBgProvider({
    baseUrl: config.removeBgBaseUrl,
  });

  return Object.freeze({
    makers,
    downloader,
    removebg,
  });
}
