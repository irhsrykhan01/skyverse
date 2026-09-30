import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { clearAuthState, loadAuthState } from './auth.js';
import { createWhatsAppLogger } from './logger.js';
import { isInvalidSessionDisconnect, recoveryDelay, recoveryReason } from './recovery.js';

function normalizePairingNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

function formatPairingCode(value) {
  const compact = String(value ?? '').replace(/\s+/g, '');
  return compact.match(/.{1,4}/g)?.join('-') ?? compact;
}

function disconnectStatus(error) {
  return new Boom(error)?.output?.statusCode ?? null;
}

export function createWhatsAppConnection({ config, logger, onSocket }) {
  let socket = null;
  let stopping = false;
  let reconnectTimer = null;
  let recoveryTimer = null;
  let reconnectAttempt = 0;
  let recoveryAttempt = 0;
  let connectionGeneration = 0;
  let recoveryMode = false;
  const baileysLogger = createWhatsAppLogger(config.whatsappLogLevel);

  async function resolveWhatsAppVersion() {
    try {
      const { version } = await fetchLatestBaileysVersion();
      return version;
    } catch {
      return undefined;
    }
  }

  function clearReconnectTimers() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (recoveryTimer) {
      clearTimeout(recoveryTimer);
      recoveryTimer = null;
    }
  }

  async function connect({ freshAuth = false, forceQr = false } = {}) {
    if (stopping || socket) return socket;

    if (freshAuth) {
      await clearAuthState(config.authPath, logger);
      recoveryMode = true;
    }

    const { state, saveCreds } = await loadAuthState(config.authPath);
    const version = await resolveWhatsAppVersion();
    const pairingEnabled = !forceQr && Boolean(config.usePairingCode) && !state.creds.registered;
    let pairingRequested = false;
    const connectionId = ++connectionGeneration;

    const nextSocket = makeWASocket({
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

    socket = nextSocket;
    nextSocket.ev.on('creds.update', (updatedCreds) => {
      if (connectionId !== connectionGeneration || socket !== nextSocket) return;
      return saveCreds(updatedCreds);
    });

    nextSocket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (connectionId !== connectionGeneration || socket !== nextSocket) return;

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
              const code = await nextSocket.requestPairingCode(phoneNumber);
              logger.info(`Kode pairing WhatsApp: ${formatPairingCode(code)}`);
              logger.info('Masukkan kode tersebut dari WhatsApp → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon.');
            } catch (error) {
              logger.error(`Gagal meminta pairing code = ${error?.message ?? String(error)}`);
              logger.info('Pairing code gagal, QR ditampilkan sebagai fallback.');
              qrcode.generate(qr, { small: true });
            }
          }
        } else {
          logger.info(
            recoveryMode
              ? '🔐 Recovery Mode: scan QR WhatsApp untuk menghubungkan ulang SkyVerse dengan akun baru.'
              : 'Scan QR WhatsApp untuk menghubungkan perangkat.',
          );
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        reconnectAttempt = 0;
        recoveryAttempt = 0;
        recoveryMode = false;
        logger.info('Terhubung, SkyVerse siap digunakan.');
      }

      if (connection !== 'close') return;

      const statusCode = disconnectStatus(lastDisconnect?.error);
      const invalidSession = isInvalidSessionDisconnect(statusCode);

      socket = null;

      if (stopping) return;

      if (invalidSession) {
        recoveryMode = true;
        recoveryAttempt += 1;
        clearReconnectTimers();

        const delay = recoveryDelay(recoveryAttempt);
        const reason = recoveryReason(statusCode);

        logger.warn(
          `WhatsApp session tidak valid (${reason}${statusCode ? `, kode ${statusCode}` : ''}). Auth lama akan direset dan QR baru disiapkan dalam ${Math.ceil(delay / 1000)} detik.`,
        );

        recoveryTimer = setTimeout(async () => {
          recoveryTimer = null;
          try {
            await connect({ freshAuth: true, forceQr: true });
          } catch (error) {
            socket = null;
            logger.error(`Error WhatsApp recovery = ${error?.message ?? String(error)}`);
            scheduleRecovery(statusCode);
          }
        }, delay);
        return;
      }

      logger.warn(`WhatsApp terputus${statusCode ? ` (kode ${statusCode})` : ''}.`);
      scheduleReconnect(statusCode);
    });

    if (onSocket) await onSocket(nextSocket);
    return nextSocket;
  }

  function scheduleReconnect(statusCode) {
    if (reconnectTimer || recoveryTimer || stopping) return;

    reconnectAttempt += 1;
    const delay = Math.min(30_000, 2_000 * 2 ** Math.min(reconnectAttempt - 1, 4));

    logger.warn(
      `Koneksi WhatsApp terputus. Mencoba terhubung lagi dalam ${Math.ceil(delay / 1000)} detik${statusCode ? ` (kode ${statusCode})` : ''}.`,
    );

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      try {
        await connect();
      } catch (error) {
        socket = null;
        logger.error(`Error reconnect = ${error?.message ?? String(error)}`);
        scheduleReconnect(undefined);
      }
    }, delay);
  }

  function scheduleRecovery(statusCode) {
    if (recoveryTimer || stopping) return;

    recoveryMode = true;
    recoveryAttempt += 1;
    const delay = recoveryDelay(recoveryAttempt);
    const reason = recoveryReason(statusCode);

    logger.warn(
      `Recovery WhatsApp dijadwalkan ulang dalam ${Math.ceil(delay / 1000)} detik (${reason}).`,
    );

    recoveryTimer = setTimeout(async () => {
      recoveryTimer = null;
      try {
        await connect({ freshAuth: true, forceQr: true });
      } catch (error) {
        socket = null;
        logger.error(`Error retry recovery = ${error?.message ?? String(error)}`);
        scheduleRecovery(statusCode);
      }
    }, delay);
  }

  async function start() {
    stopping = false;
    clearReconnectTimers();
    await connect();
  }

  async function stop() {
    stopping = true;
    clearReconnectTimers();
    connectionGeneration += 1;

    const current = socket;
    socket = null;

    if (current) {
      try { current.end(undefined); }
      catch (error) { logger.debug('Socket close failed', { error: error?.message ?? String(error) }); }
    }
  }

  return Object.freeze({
    start,
    stop,
    get socket() { return socket; },
    get recoveryMode() { return recoveryMode; },
  });
}
