export function createLifecycle({ logger, whatsapp }) {
  let started = false;
  let stopping = false;

  async function start() {
    if (started) return;
    started = true;

    logger.info('SkyVerse foundation started');
    await whatsapp.start();
  }

  async function stop(signal = 'unknown') {
    if (!started || stopping) return;
    stopping = true;

    try {
      await whatsapp.stop();
    } finally {
      logger.info(`SkyVerse shutting down (${signal})`);
    }
  }

  return Object.freeze({ start, stop });
}
