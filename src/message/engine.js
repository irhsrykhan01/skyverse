import { createMessageContext } from './context.js';
import { getMessageText, parseIncomingMessage } from './parser.js';

const STATUS_JIDS = new Set(['status@broadcast']);

function requiredPermissionOrder(level) {
  return { user: 0, admin: 1, owner: 2 }[level] ?? 0;
}

export function createMessageEngine({ config, logger, identity, registry }) {
  const seen = new Map();
  const seenTtl = 60_000;

  function pruneSeen() {
    const now = Date.now();
    for (const [id, timestamp] of seen) {
      if (now - timestamp > seenTtl) seen.delete(id);
    }
  }

  async function handleMessage(socket, message) {
    if (!message?.message || message.key?.fromMe) return;
    const chatId = message.key?.remoteJid;
    const messageId = message.key?.id;
    if (!chatId || !messageId || STATUS_JIDS.has(chatId)) return;

    pruneSeen();
    if (seen.has(messageId)) return;
    seen.set(messageId, Date.now());

    if (config.autoRead) {
      try {
        await socket.readMessages([message.key]);
      } catch (error) {
        logger.warn('Failed to mark message as read', { error: error?.message ?? String(error) });
      }
    }

    const parsed = parseIncomingMessage(message, config.prefix);
    if (!parsed) return;

    const command = registry.resolve(parsed.name);
    if (!command) {
      const suggestions = registry.suggest(parsed.name);
      if (suggestions.length) {
        await socket.sendMessage(chatId, {
          text: `Command tidak ditemukan.\n\nMungkin maksud kamu:\n${suggestions.map((item) => `${config.prefix}${item}`).join('\n')}\n\nKetik ${config.prefix}help untuk bantuan.`,
        }, { quoted: message });
      }
      return;
    }

    const context = createMessageContext({
      socket,
      message,
      command,
      registry,
      identity,
      config,
      parsed,
    });

    const permission = await context.permissionLevel();
    if (requiredPermissionOrder(permission) < requiredPermissionOrder(command.permission)) {
      await context.reply('Kamu tidak memiliki izin untuk menggunakan command ini.');
      return;
    }

    try {
      await command.execute(context);
    } catch (error) {
      logger.error('Command execution failed', {
        command: command.name,
        sender: context.senderJid,
        chat: chatId,
        error: error?.message ?? String(error),
      });
      await context.reply('Terjadi kesalahan saat menjalankan command. Coba lagi nanti.');
    }
  }

  function attach(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages ?? []) {
        await handleMessage(socket, message);
      }
    });

    socket.ev.on('messages.update', (updates) => {
      logger.debug('Messages updated', { count: updates?.length ?? 0 });
    });

    socket.ev.on('messages.delete', (event) => {
      logger.debug('Messages deleted', { count: event?.keys?.length ?? 0 });
    });

    socket.ev.on('messages.reaction', (reactions) => {
      logger.debug('Message reactions received', { count: reactions?.length ?? 0 });
    });

    socket.ev.on('message-receipt.update', (updates) => {
      logger.debug('Message receipts updated', { count: updates?.length ?? 0 });
    });

    socket.ev.on('presence.update', (update) => {
      logger.debug('Presence updated', { jid: update?.id });
    });

    socket.ev.on('groups.upsert', (groups) => {
      logger.debug('Groups synced', { count: groups?.length ?? 0 });
    });

    socket.ev.on('groups.update', (groups) => {
      logger.debug('Groups updated', { count: groups?.length ?? 0 });
    });

    socket.ev.on('group-participants.update', (update) => {
      logger.debug('Group participants updated', {
        jid: update?.id,
        action: update?.action,
        count: update?.participants?.length ?? 0,
      });
    });

    socket.ev.on('connection.update', async ({ connection }) => {
      if (connection === 'open' && config.autoOnline) {
        try {
          await socket.sendPresenceUpdate('available');
          logger.info('WhatsApp presence set to online');
        } catch (error) {
          logger.warn('Failed to set online presence', { error: error?.message ?? String(error) });
        }
      }
    });
  }

  return Object.freeze({ attach, handleMessage });
}
