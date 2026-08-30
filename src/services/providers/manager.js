import { createDepayProvider } from './depay.js';
import { createKeyraDownloaderProvider } from './keyra-downloaders.js';
import { createRemoveBgProvider } from './removebg.js';

export function createProviderManager(config) {
  const depay = createDepayProvider({
    baseUrl: config.depayBaseUrl,
  });

  const keyraDownloader = createKeyraDownloaderProvider({
    apiKey: config.keyraApiKey,
    baseUrl: config.keyraBaseUrl,
  });

  // Keyra is the primary downloader provider. Facebook is intentionally
  // routed to Depay because Keyra's current public catalog does not expose
  // a Facebook downloader endpoint.
  const downloader = Object.freeze({
    ...keyraDownloader,
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
