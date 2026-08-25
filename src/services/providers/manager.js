import { createDepayProvider } from './depay.js';
import { createKeyraDownloaderProvider } from './keyra-downloaders.js';

export function createProviderManager(config) {
  const depay = createDepayProvider({
    baseUrl: config.depayBaseUrl,
  });

  const downloader = createKeyraDownloaderProvider({
    apiKey: config.keyraApiKey,
    baseUrl: config.keyraBaseUrl,
  });

  return Object.freeze({
    depay,
    downloader,
  });
}
