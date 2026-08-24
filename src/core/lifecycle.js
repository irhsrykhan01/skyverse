export function createLifecycle({ logger }) {
  let started = false;
  let stopping = false;

  async function start() {
    if (started) return;
    started = true;
    logger.info('SkyVerse foundation started');
  }

  async function stop(signal = 'unknown') {
    if (!started || stopping) return;
    stopping = true;
    logger.info(`SkyVerse shutting down (${signal})`);
  }

  return Object.freeze({ start, stop });
}
