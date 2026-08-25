import { createDepayProvider } from './depay.js';
import { createKeyraDownloaderProvider } from './keyra-downloaders.js';
import { createRemoveBgProvider } from './removebg.js';

export function createProviderManager(config) {
  const depay = createDepayProvider({
    baseUrl: config.depayBaseUrl,
  });

  const downloader = createKeyraDownloaderProvider({
    apiKey: config.keyraApiKey,
    baseUrl: config.keyraBaseUrl,
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
