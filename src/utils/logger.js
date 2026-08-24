const levels = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

function write(level, message, meta = undefined) {
  const timestamp = new Date().toISOString();
  const payload = {
    timestamp,
    level,
    message,
    ...(meta ? { meta } : {}),
  };

  const output = JSON.stringify(payload);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export function createLogger(level = 'info') {
  const threshold = levels[level] ?? levels.info;

  return Object.freeze({
    debug: (message, meta) => levels.debug >= threshold && write('debug', message, meta),
    info: (message, meta) => levels.info >= threshold && write('info', message, meta),
    warn: (message, meta) => levels.warn >= threshold && write('warn', message, meta),
    error: (message, meta) => levels.error >= threshold && write('error', message, meta),
  });
}
