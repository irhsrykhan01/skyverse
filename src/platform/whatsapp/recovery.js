import { DisconnectReason } from '@whiskeysockets/baileys';

const INVALID_SESSION_CODES = new Set([
  DisconnectReason.loggedOut,
  DisconnectReason.multideviceMismatch,
  DisconnectReason.badSession,
]);

export function disconnectStatus(error) {
  if (!error || typeof error !== 'object') return null;
  const candidate = error.output?.statusCode ?? error.statusCode ?? error.status;
  const statusCode = Number(candidate);
  return Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
    ? statusCode
    : null;
}

export function isInvalidSessionDisconnect(statusCode) {
  return INVALID_SESSION_CODES.has(Number(statusCode));
}

export function recoveryDelay(attempt = 1) {
  const safeAttempt = Math.max(1, Math.floor(Number(attempt) || 1));
  return Math.min(10_000, 1_000 * 2 ** Math.min(safeAttempt - 1, 3));
}

export function recoveryReason(statusCode) {
  switch (statusCode) {
    case DisconnectReason.loggedOut:
      return 'logged_out';
    case DisconnectReason.connectionReplaced:
      return 'connection_replaced';
    case DisconnectReason.multideviceMismatch:
      return 'multidevice_mismatch';
    case DisconnectReason.forbidden:
      return 'forbidden';
    case DisconnectReason.badSession:
      return 'bad_session';
    default:
      return 'unknown';
  }
}
