import 'dotenv/config';
import { config } from './config/index.js';
import { createCommandRegistry } from './commands/registry.js';
import { createDatabase, createRepositories } from './database/index.js';
import { createLifecycle } from './core/lifecycle.js';
import { createMessageEngine } from './message/engine.js';
import { createWhatsAppConnection } from './platform/whatsapp/index.js';
import { createIdentity } from './security/identity.js';
import { createProviderManager } from './services/providers/manager.js';
import { EconomyManager } from './economy/manager.js';
import { createLogger } from './utils/logger.js';
import { getErrorMessage } from './utils/errors.js';

const logger = createLogger(config.logLevel);
const identity = createIdentity({ config });
const providers = createProviderManager(config);
let lifecycle = null;

const ASCII_BANNER = String.raw`
███████╗██╗  ██╗██╗   ██╗██╗   ██╗███████╗██████╗ ███████╗███████╗
██╔════╝██║ ██╔╝╚██╗ ██╔╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
███████╗█████╔╝  ╚████╔╝ ██║   ██║█████╗  ██████╔╝███████╗█████╗
╚════██║██╔═██╗   ╚██╔╝  ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝
███████║██║  ██╗   ██║    ╚████╔╝ ███████╗██║  ██║███████║███████╗
╚══════╝╚═╝  ╚═╝   ╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝
`;

function clearTerminal() {
  if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[H');
}

function installNoiseFilter() {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    const text = args.map((value) => String(value)).join(' ');
    if (/Failed to decrypt message with any known session|Bad MAC|Session error:/i.test(text)) {
      logger.error(`WhatsApp decryption error = ${text.replace(/\s+/g, ' ').trim()}`);
      return;
    }
    originalConsoleError(...args);
  };
}

function assertRuntime() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    throw new Error(`SkyVerse membutuhkan Node.js 20 atau lebih baru. Versi saat ini: ${process.versions.node}`);
  }
}

async function main() {
  clearTerminal();
  installNoiseFilter();
  console.log(ASCII_BANNER);
  logger.info('SkyVerse dimulai!');

  assertRuntime();

  const database = await createDatabase(config.databasePath, logger);
  const repositories = createRepositories(database);
  const economy = new EconomyManager({ repositories });
  const registry = await createCommandRegistry();
  logger.info(`Memuat ${registry.all().length} command.`);

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
    economy,
    providers,
  });
  lifecycle = createLifecycle({ logger, whatsapp, database });

  logger.info('Menghubungkan ke WhatsApp...');
  await lifecycle.start();
}

const shutdownSignals = ['SIGINT', 'SIGTERM'];
for (const signal of shutdownSignals) {
  process.once(signal, async () => {
    try {
      await lifecycle?.stop(signal);
      logger.info('SkyVerse dihentikan.');
      process.exitCode = 0;
    } catch (error) {
      logger.error(`Error shutdown = ${getErrorMessage(error)}`);
      process.exitCode = 1;
    }
  });
}

process.on('uncaughtException', (error) => {
  logger.error(`Error fatal = ${getErrorMessage(error)}`);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Error async = ${getErrorMessage(reason)}`);
});

main().catch((error) => {
  logger.error(`Error startup = ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
