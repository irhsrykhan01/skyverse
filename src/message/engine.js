import { createMessageContext } from './context.js';
import { parseIncomingMessage } from './parser.js';

const STATUS_JIDS = new Set(['status@broadcast']);
const PERMISSION_ORDER = Object.freeze({ user: 0, admin: 1, owner: 2 });
const NEWSLETTER_META_TTL = 6 * 60 * 60 * 1000;

function displaySender(jid, chatId) {
  if (chatId?.endsWith('@newsletter')) return 'Channel';
  if (chatId?.endsWith('@broadcast')) return 'Broadcast';
  if (!jid) return 'unknown';
  return `+${String(jid).replace(/@(s\.whatsapp\.net|lid|g\.us|newsletter|broadcast)$/i, '').replace(/^\+/, '')}`;
}

function chatType(jid) {
  if (jid?.endsWith('@g.us')) return 'group';
  if (jid?.endsWith('@newsletter')) return 'channel';
  if (jid?.endsWith('@broadcast')) return 'broadcast';
  return 'private';
}

function errorCode(error) {
  return error?.output?.statusCode ?? error?.statusCode ?? error?.status ?? error?.code ?? null;
}

export function createMessageEngine({ config, logger, identity, registry, repositories, providers }) {
  const seen = new Map();
  const cooldowns = new Map();
  const newsletterMessages = new Map();
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
    for (const [key, value] of newsletterMessages) {
      if (value.expiresAt <= now) newsletterMessages.delete(key);
    }
  }

  function rememberNewsletterMessage(message) {
    const chatId = message.key?.remoteJid;
    const messageId = message.key?.id;
    if (!chatId?.endsWith('@newsletter') || !messageId) return;
    const serverId = message.key?.server_id;
    if (!serverId) return;
    newsletterMessages.set(`${chatId}:${messageId}`, {
      serverId: String(serverId),
      participant: message.key?.participant ?? null,
      fromMe: Boolean(message.key?.fromMe),
      messageId,
      expiresAt: Date.now() + NEWSLETTER_META_TTL,
    });
  }

  function resolveNewsletterMessage(remoteJid, messageId) {
    if (!remoteJid?.endsWith('@newsletter') || !messageId) return null;
    return newsletterMessages.get(`${remoteJid}:${messageId}`) ?? null;
  }

  async function safeReact(context, emoji) {
    try { await context.react(emoji); }
    catch (error) { logger.debug('Progress reaction failed', { emoji, error: error?.message ?? String(error) }); }
  }

  async function handleMessage(socket, message) {
    if (!message?.message) return;

    rememberNewsletterMessage(message);

    if (message.key?.fromMe) return;

    const chatId = message.key?.remoteJid;
    const messageId = message.key?.id;
    const senderJid = message.key?.participant ?? chatId;
    if (!chatId || !messageId || STATUS_JIDS.has(chatId)) return;

    prune();
    const dedupKey = `${chatId}:${messageId}`;
    if (seen.has(dedupKey)) return;
    seen.set(dedupKey, Date.now());

    repositories.users.upsert({ jid: senderJid, pushName: message.pushName ?? null, isBot: false });
    if (chatId.endsWith('@g.us')) repositories.groups.upsert({ jid: chatId });

    if (config.autoRead) {
      try { await socket.readMessages([message.key]); }
      catch (error) { logger.debug('Read receipt failed', { error: error?.message ?? String(error) }); }
    }

    const parsed = parseIncomingMessage(message, config.prefix);
    if (!parsed) return;

    logger.info(`Dari ${displaySender(senderJid, chatId)} = ${parsed.raw}`);

    const command = registry.resolve(parsed.name);
    if (!command) {
      const suggestions = registry.suggest(parsed.name);
      if (suggestions.length) {
        await socket.sendMessage(chatId, {
          text: ['Command tidak ditemukan.', '', 'Mungkin maksud kamu:', ...suggestions.map((item) => `${config.prefix}${item}`), '', `Ketik ${config.prefix}help untuk bantuan.`].join('\n'),
        });
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
      providers,
      repositories,
      resolveNewsletterMessage,
    });

    const permission = await context.permissionLevel(command.permission);
    if ((PERMISSION_ORDER[permission] ?? 0) < (PERMISSION_ORDER[command.permission] ?? 0)) {
      await context.reply('Kamu tidak memiliki izin untuk menggunakan command ini.');
      return;
    }

    if (parsed.args.length < command.minArgs || (command.maxArgs !== null && parsed.args.length > command.maxArgs)) {
      const usage = command.usage ? `${config.prefix}${command.usage}` : `${config.prefix}${command.name}`;
      await context.reply(`Format penggunaan tidak sesuai.\n\nUsage: ${usage}`);
      return;
    }

    if (command.cooldown > 0 && !context.isOwner) {
      const key = `${command.name}:${senderJid ?? chatId}`;
      const until = cooldowns.get(key) ?? 0;
      if (until > Date.now()) {
        await context.reply(`Tunggu ${Math.ceil((until - Date.now()) / 1000)} detik sebelum memakai command ini lagi.`);
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
      logger.info(`Bot = ${command.name} selesai`);
    } catch (error) {
      const code = errorCode(error);
      const detail = error?.message ?? String(error);
      logger.error(`Error${code ? ` ${code}` : ''} = ${detail}`);
      if (slowReactionShown) await safeReact(context, '❌');
      try { await context.reply('Terjadi kesalahan saat menjalankan command. Coba lagi nanti.'); }
      catch (replyError) { logger.debug('Failed to send error response', { error: replyError?.message ?? String(replyError) }); }
    } finally {
      if (slowReactionTimer) clearTimeout(slowReactionTimer);
    }
  }

  function attach(socket) {
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type && type !== 'notify') return;
      for (const message of messages ?? []) {
        try { await handleMessage(socket, message); }
        catch (error) {
          const code = errorCode(error);
          logger.error(`Error${code ? ` ${code}` : ''} = ${error?.message ?? String(error)}`);
        }
      }
    });

    socket.ev.on('messages.update', () => {});
    socket.ev.on('messages.delete', () => {});
    socket.ev.on('messages.reaction', () => {});
    socket.ev.on('message-receipt.update', () => {});
    socket.ev.on('presence.update', () => {});
    socket.ev.on('groups.upsert', () => {});
    socket.ev.on('groups.update', () => {});
    socket.ev.on('group-participants.update', () => {});
    socket.ev.on('connection.update', async ({ connection }) => {
      if (connection === 'open' && config.autoOnline) {
        try { await socket.sendPresenceUpdate('available'); }
        catch (error) { logger.debug('Presence update failed', { error: error?.message ?? String(error) }); }
      }
    });
  }

  return Object.freeze({ attach, handleMessage });
}
