import pino from 'pino';

export function createWhatsAppLogger(level = 'silent') {
  return pino({ level });
}
