import 'dotenv/config';
import { config } from './config/index.js';
import { createCommandRegistry } from './commands/registry.js';
import { createDatabase, createRepositories } from './database/index.js';
import { createLifecycle } from './core/lifecycle.js';
import { createMessageEngine } from './message/engine.js';
import { createWhatsAppConnection } from './platform/whatsapp/index.js';
import { createIdentity } from './security/identity.js';
import { createProviderManager } from './services/providers/manager.js';
import { createLogger } from './utils/logger.js';
import { getErrorMessage } from './utils/errors.js';

const logger = createLogger(config.logLevel);
const identity = createIdentity({ config });
const providers = createProviderManager(config);
let lifecycle = null;

function assertRuntime() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    throw new Error(`SkyVerse requires Node.js 20 or newer. Current version: ${process.versions.node}`);
  }
}

async function main() {
  assertRuntime();

  const database = await createDatabase(config.databasePath, logger);
  const repositories = createRepositories(database);
  const registry = await createCommandRegistry();
  logger.info('Command registry loaded', { commands: registry.all().length });

  let messageEngine;
  const whatsapp = createWhatsAppConnection({
    config,
    logger,
    onSocket: async (socket) => messageEngine.attach(socket),
  });

  messageEngine = createMessageEngine({
    config,
    logger,
    identity,
    registry,
    repositories,
    providers,
  });
  lifecycle = createLifecycle({ logger, whatsapp, database });

  logger.info(`${config.botName} starting`, {
    environment: config.nodeEnv,
    node: process.versions.node,
    prefix: config.prefix,
    providers: ['keyra'],
  });

  await lifecycle.start();
}

const shutdownSignals = ['SIGINT', 'SIGTERM'];
for (const signal of shutdownSignals) {
  process.once(signal, async () => {
    try {
      await lifecycle?.stop(signal);
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
