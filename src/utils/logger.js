const levels = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

const ICONS = Object.freeze({ info: 'info', warn: 'warn', error: 'error', debug: 'debug' });

function timestamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function write(level, message, meta = undefined) {
  const prefix = `[${timestamp()}] [${ICONS[level] ?? level}]`;
  const suffix = meta && Object.keys(meta).length ? ` ${formatMeta(meta)}` : '';
  const line = `${prefix} ${String(message)}${suffix}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level !== 'debug') console.log(line);
}

function formatMeta(meta) {
  return Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' | ');
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
