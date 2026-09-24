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

function normalizePairingNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

function formatPairingCode(value) {
  const compact = String(value ?? '').replace(/\s+/g, '');
  return compact.match(/.{1,4}/g)?.join('-') ?? compact;
}

export function createWhatsAppConnection({ config, logger, onSocket }) {
  let socket = null;
  let stopping = false;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  const baileysLogger = createWhatsAppLogger(config.whatsappLogLevel);

  async function resolveWhatsAppVersion() {
    try {
      const { version } = await fetchLatestBaileysVersion();
      return version;
    } catch {
      return undefined;
    }
  }

  async function connect() {
    if (stopping || socket) return socket;

    const { state, saveCreds } = await loadAuthState(config.authPath);
    const version = await resolveWhatsAppVersion();
    const pairingEnabled = Boolean(config.usePairingCode) && !state.creds.registered;
    let pairingRequested = false;

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

    socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        if (pairingEnabled && !pairingRequested) {
          pairingRequested = true;
          const phoneNumber = normalizePairingNumber(config.pairingNumber);

          if (!phoneNumber) {
            logger.warn('USE_PAIRING_CODE aktif tetapi PAIRING_NUMBER kosong/tidak valid. Menampilkan QR sebagai fallback.');
            qrcode.generate(qr, { small: true });
          } else {
            logger.info('Meminta pairing code WhatsApp...');
            try {
              const code = await socket.requestPairingCode(phoneNumber);
              logger.info(`Kode pairing WhatsApp: ${formatPairingCode(code)}`);
              logger.info('Masukkan kode tersebut dari WhatsApp → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon.');
            } catch (error) {
              logger.error(`Gagal meminta pairing code = ${error?.message ?? String(error)}`);
              logger.info('Pairing code gagal, QR ditampilkan sebagai fallback.');
              qrcode.generate(qr, { small: true });
            }
          }
        } else if (!pairingEnabled) {
          logger.info('Scan QR WhatsApp untuk menghubungkan perangkat.');
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        reconnectAttempt = 0;
        logger.info('Terhubung, SkyVerse siap digunakan.');
      }

      if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        socket = null;

        if (stopping || loggedOut) {
          logger.warn(`WhatsApp terputus${statusCode ? ` (kode ${statusCode})` : ''}.`);
          return;
        }

        scheduleReconnect(statusCode);
      }
    });

    if (onSocket) await onSocket(socket);
    return socket;
  }

  function scheduleReconnect(statusCode) {
    if (reconnectTimer || stopping) return;
    reconnectAttempt += 1;
    const delay = Math.min(30_000, 2_000 * 2 ** Math.min(reconnectAttempt - 1, 4));

    logger.warn(`Koneksi WhatsApp terputus. Mencoba terhubung lagi dalam ${Math.ceil(delay / 1000)} detik${statusCode ? ` (kode ${statusCode})` : ''}.`);

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      try { await connect(); }
      catch (error) {
        socket = null;
        logger.error(`Error reconnect = ${error?.message ?? String(error)}`);
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
      try { socket.end(undefined); }
      catch (error) { logger.debug('Socket close failed', { error: error?.message ?? String(error) }); }
    }
    socket = null;
  }

  return Object.freeze({
    start,
    stop,
    get socket() { return socket; },
  });
}
