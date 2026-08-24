import { config } from './config/index.js';
import { createLifecycle } from './core/lifecycle.js';
import { createWhatsAppConnection } from './platform/whatsapp/index.js';
import { createLogger } from './utils/logger.js';
import { getErrorMessage } from './utils/errors.js';

const logger = createLogger(config.logLevel);
const whatsapp = createWhatsAppConnection({ config, logger });
const lifecycle = createLifecycle({ logger, whatsapp });

function assertRuntime() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    throw new Error(`SkyVerse requires Node.js 20 or newer. Current version: ${process.versions.node}`);
  }
}

async function main() {
  assertRuntime();

  logger.info(`${config.botName} starting`, {
    environment: config.nodeEnv,
    node: process.versions.node,
    prefix: config.prefix,
  });

  await lifecycle.start();
}

const shutdownSignals = ['SIGINT', 'SIGTERM'];
for (const signal of shutdownSignals) {
  process.once(signal, async () => {
    try {
      await lifecycle.stop(signal);
      process.exitCode = 0;
    } catch (error) {
      logger.error('Shutdown failed', { error: getErrorMessage(error) });
      process.exitCode = 1;
    }
  });
}

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: getErrorMessage(error) });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: getErrorMessage(reason) });
});

main().catch((error) => {
  logger.error('SkyVerse failed to start', { error: getErrorMessage(error) });
  process.exitCode = 1;
});
