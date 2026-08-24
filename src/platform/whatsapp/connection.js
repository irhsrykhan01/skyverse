import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { loadAuthState } from './auth.js';
import { createWhatsAppLogger } from './logger.js';

export function createWhatsAppConnection({ config, logger }) {
  let socket = null;
  let stopping = false;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  const baileysLogger = createWhatsAppLogger(config.whatsappLogLevel);

  async function resolveWhatsAppVersion() {
    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info('Resolved WhatsApp Web version', { version, isLatest });
      return version;
    } catch (error) {
      logger.warn('Could not resolve latest WhatsApp Web version; using Baileys default', {
        error: error?.message ?? String(error),
      });
      return undefined;
    }
  }

  async function connect() {
    if (stopping || socket) return socket;

    const { state, saveCreds } = await loadAuthState(config.authPath);
    const version = await resolveWhatsAppVersion();

    socket = makeWASocket({
      ...(version ? { version } : {}),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      browser: Browsers.macOS('Google Chrome'),
      logger: baileysLogger,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      qrTimeout: 180_000,
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        logger.info('Scan the WhatsApp QR code to connect.');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        reconnectAttempt = 0;
        logger.info('WhatsApp connection opened');
      }

      if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        socket = null;

        if (stopping || loggedOut) {
          logger.warn('WhatsApp connection closed', { statusCode, reconnect: false });
          return;
        }

        scheduleReconnect(statusCode);
      }
    });

    return socket;
  }

  function scheduleReconnect(statusCode) {
    if (reconnectTimer || stopping) return;

    reconnectAttempt += 1;
    const delay = Math.min(30_000, 2_000 * 2 ** Math.min(reconnectAttempt - 1, 4));

    logger.warn('WhatsApp connection closed; scheduling reconnect', {
      statusCode,
      attempt: reconnectAttempt,
      delayMs: delay,
    });

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      try {
        await connect();
      } catch (error) {
        socket = null;
        logger.error('WhatsApp reconnect failed', {
          error: error?.message ?? String(error),
        });
        scheduleReconnect(undefined);
      }
    }, delay);
  }

  async function start() {
    stopping = false;
    await connect();
  }

  async function stop() {
    stopping = true;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket) {
      try {
        socket.end(undefined);
      } catch (error) {
        logger.warn('WhatsApp socket close failed', {
          error: error?.message ?? String(error),
        });
      }
    }

    socket = null;
  }

  return Object.freeze({
    start,
    stop,
    get socket() {
      return socket;
    },
  });
}
