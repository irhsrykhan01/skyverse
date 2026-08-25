import { createKeyraProvider } from './keyra.js';

export function createProviderManager(config) {
  const keyra = createKeyraProvider({
    apiKey: config.keyraApiKey,
    baseUrl: config.keyraBaseUrl,
  });

  return Object.freeze({ keyra });
}
