export function createLifecycle({ logger, whatsapp, database }) {
  let started = false;
  let stopping = false;

  async function start() {
    if (started) return;
    started = true;

    logger.info('SkyVerse foundation started');
    logger.info('Database ready', { path: database.path });
    await whatsapp.start();
  }

  async function stop(signal = 'unknown') {
    if (!started || stopping) return;
    stopping = true;

    try {
      await whatsapp.stop();
    } finally {
      try {
        await database.close();
      } finally {
        logger.info(`SkyVerse shutting down (${signal})`);
      }
    }
  }

  return Object.freeze({ start, stop });
}
