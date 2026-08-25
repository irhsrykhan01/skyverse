import { createMessageContext } from './context.js';
import { parseIncomingMessage } from './parser.js';

const STATUS_JIDS = new Set(['status@broadcast']);
const PERMISSION_ORDER = Object.freeze({ user: 0, admin: 1, owner: 2 });

export function createMessageEngine({ config, logger, identity, registry, repositories, providers }) {
  const seen = new Map();
  const cooldowns = new Map();
  const seenTtl = 60_000;
  const slowCommandDelay = 900;

  function prune() {
    const now = Date.now();
    for (const [id, timestamp] of seen) {
      if (now - timestamp > seenTtl) seen.delete(id);
    }
    for (const [key, until] of cooldowns) {
      if (until <= now) cooldowns.delete(key);
    }
  }

  async function safeReact(context, emoji) {
    try {
      await context.react(emoji);
    } catch (error) {
      logger.debug('Command progress reaction failed', {
        emoji,
        error: error?.message ?? String(error),
      });
    }
  }

  async function handleMessage(socket, message) {
    if (!message?.message || message.key?.fromMe) return;

    const chatId = message.key?.remoteJid;
    const messageId = message.key?.id;
    const senderJid = message.key?.participant ?? chatId;
    if (!chatId || !messageId || STATUS_JIDS.has(chatId)) return;

    prune();
    const dedupKey = `${chatId}:${messageId}`;
    if (seen.has(dedupKey)) return;
    seen.set(dedupKey, Date.now());

    repositories.users.upsert({
      jid: senderJid,
      pushName: message.pushName ?? null,
      isBot: false,
    });
    if (chatId.endsWith('@g.us')) repositories.groups.upsert({ jid: chatId });

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
          text: [
            'Command tidak ditemukan.', '', 'Mungkin maksud kamu:',
            ...suggestions.map((item) => `${config.prefix}${item}`), '',
            `Ketik ${config.prefix}help untuk bantuan.`,
          ].join('\n'),
        }, { quoted: message });
      }
      return;
    }

    const context = createMessageContext({ socket, message, command, registry, identity, config, parsed, providers });

    const permission = await context.permissionLevel(command.permission);
    if ((PERMISSION_ORDER[permission] ?? 0) < (PERMISSION_ORDER[command.permission] ?? 0)) {
      await context.reply('Kamu tidak memiliki izin untuk menggunakan command ini.');
      return;
    }

    if (parsed.args.length < command.minArgs ||
        (command.maxArgs !== null && parsed.args.length > command.maxArgs)) {
      const usage = command.usage ? `${config.prefix}${command.usage}` : `${config.prefix}${command.name}`;
      await context.reply(`Format penggunaan tidak sesuai.\n\nUsage: ${usage}`);
      return;
    }

    if (command.cooldown > 0 && !context.isOwner) {
      const key = `${command.name}:${senderJid ?? chatId}`;
      const until = cooldowns.get(key) ?? 0;
      if (until > Date.now()) {
        const seconds = Math.ceil((until - Date.now()) / 1000);
        await context.reply(`Tunggu ${seconds} detik sebelum memakai command ini lagi.`);
        return;
      }
      cooldowns.set(key, Date.now() + command.cooldown);
    }

    let slowReactionTimer = null;
    let slowReactionShown = false;
    try {
      repositories.commands.increment(command.name);
      slowReactionTimer = setTimeout(async () => {
        slowReactionShown = true;
        await safeReact(context, '⏳');
      }, slowCommandDelay);

      await command.execute(context);

      if (slowReactionShown) await safeReact(context, '✅');
    } catch (error) {
      logger.error('Command execution failed', {
        command: command.name,
        sender: context.senderJid,
        chat: chatId,
        error: error?.message ?? String(error),
      });
      if (slowReactionShown) await safeReact(context, '❌');
      try {
        await context.reply('Terjadi kesalahan saat menjalankan command. Coba lagi nanti.');
      } catch (replyError) {
        logger.warn('Failed to send command error response', {
          error: replyError?.message ?? String(replyError),
        });
      }
    } finally {
      if (slowReactionTimer) clearTimeout(slowReactionTimer);
    }
  }

  function attach(socket) {
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type && type !== 'notify') return;
      for (const message of messages ?? []) {
        try { await handleMessage(socket, message); }
        catch (error) { logger.error('Message processing failed', { error: error?.message ?? String(error) }); }
      }
    });

    socket.ev.on('messages.update', (updates) => logger.debug('Messages updated', { count: updates?.length ?? 0 }));
    socket.ev.on('messages.delete', (event) => logger.debug('Messages deleted', { count: event?.keys?.length ?? 0 }));
    socket.ev.on('messages.reaction', (reactions) => logger.debug('Message reactions received', { count: reactions?.length ?? 0 }));
    socket.ev.on('message-receipt.update', (updates) => logger.debug('Message receipts updated', { count: updates?.length ?? 0 }));
    socket.ev.on('presence.update', (update) => logger.debug('Presence updated', { jid: update?.id }));
    socket.ev.on('groups.upsert', (groups) => logger.debug('Groups synced', { count: groups?.length ?? 0 }));
    socket.ev.on('groups.update', (groups) => logger.debug('Groups updated', { count: groups?.length ?? 0 }));
    socket.ev.on('group-participants.update', (update) => logger.debug('Group participants updated', { jid: update?.id, action: update?.action, count: update?.participants?.length ?? 0 }));
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
