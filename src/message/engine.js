import { createMessageContext } from './context.js';
import { parseIncomingMessage } from './parser.js';
import { createAfkService } from '../services/afk.js';
import { createAntideleteService } from '../services/antidelete.js';

const STATUS_JIDS = new Set(['status@broadcast']);
const PERMISSION_ORDER = Object.freeze({ user: 0, admin: 1, owner: 2 });
const NEWSLETTER_META_TTL = 6 * 60 * 60 * 1000;
const GROUP_MESSAGE_TTL = 30 * 60 * 1000;
const MAX_GROUP_CACHED_MESSAGES = 250;

function displaySender(jid, chatId) {
  if (chatId?.endsWith('@newsletter')) return 'Channel';
  if (chatId?.endsWith('@broadcast')) return 'Broadcast';
  if (!jid) return 'unknown';
  return `+${String(jid).replace(/@(s\\.whatsapp\\.net|lid|g\\.us|newsletter|broadcast)$/i, '').replace(/^\\+/, '')}`;
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

function getContextInfo(message) {
  const content = message?.message ?? message;
  return content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.ptvMessage?.contextInfo
    ?? content?.audioMessage?.contextInfo
    ?? content?.stickerMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo
    ?? null;
}

function getMentionedJids(message) {
  const mentioned = getContextInfo(message)?.mentionedJid;
  return Array.isArray(mentioned) ? mentioned.filter(Boolean).map(String) : [];
}

function getPushName(message, jid) {
  return message?.pushName || jid?.split('@')[0] || 'User';
}

export function createMessageEngine({ config, logger, identity, registry, repositories, providers }) {
  const seen = new Map();
  const cooldowns = new Map();
  const newsletterMessages = new Map();
  const groupMessages = new Map();
  const seenTtl = 60_000;
  const slowCommandDelay = 900;
  const afk = createAfkService(repositories);
  const antidelete = createAntideleteService(repositories);

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
    for (const [groupJid, messages] of groupMessages) {
      for (const [id, value] of messages) {
        if (value.expiresAt <= now) messages.delete(id);
      }
      while (messages.size > MAX_GROUP_CACHED_MESSAGES) {
        const oldest = messages.keys().next().value;
        if (oldest === undefined) break;
        messages.delete(oldest);
      }
      if (!messages.size) groupMessages.delete(groupJid);
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

  function rememberGroupMessage(message) {
    const chatId = message.key?.remoteJid;
    const messageId = message.key?.id;
    if (!chatId?.endsWith('@g.us') || !messageId) return;
    const settings = antidelete.get(chatId);
    if (!settings.enabled) return;

    let cache = groupMessages.get(chatId);
    if (!cache) {
      cache = new Map();
      groupMessages.set(chatId, cache);
    }
    cache.set(messageId, {
      message,
      senderJid: message.key?.participant ?? chatId,
      pushName: getPushName(message, message.key?.participant ?? chatId),
      createdAt: Date.now(),
      expiresAt: Date.now() + settings.ttl,
    });
    while (cache.size > MAX_GROUP_CACHED_MESSAGES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  function resolveGroupMessage(key) {
    const jid = key?.remoteJid;
    const id = key?.id;
    if (!jid?.endsWith('@g.us') || !id) return null;
    return groupMessages.get(jid)?.get(id)?.message ?? null;
  }

  async function safeReact(context, emoji) {
    try { await context.react(emoji); }
    catch (error) { logger.debug('Progress reaction failed', { emoji, error: error?.message ?? String(error) }); }
  }

  async function handleAfkState(socket, message, chatId, senderJid) {
    if (!senderJid || !chatId) return;

    const ownAfk = afk.get({ senderJid });
    if (ownAfk) {
      afk.clear({ senderJid });
      const elapsed = Math.max(0, Math.floor((Date.now() - ownAfk.startedAt) / 60000));
      if (elapsed > 0) {
        await socket.sendMessage(chatId, { text: `Selamat datang kembali! AFK selama sekitar ${elapsed} menit.` });
      }
    }

    const mentioned = getMentionedJids(message);
    if (!mentioned.length) return;

    const notices = [];
    for (const jid of [...new Set(mentioned)]) {
      const state = afk.get({ senderJid: jid });
      if (!state) continue;
      const elapsed = Math.max(0, Math.floor((Date.now() - state.startedAt) / 60000));
      notices.push(`@${String(jid).split('@')[0]} sedang AFK — ${state.reason}${elapsed ? ` (${elapsed} menit)` : ''}`);
    }
    if (notices.length) {
      await socket.sendMessage(chatId, { text: notices.join('\n'), mentions: [...new Set(mentioned)] });
    }
  }

  async function handleMessage(socket, message) {
    if (!message?.message) return;

    prune();
    rememberNewsletterMessage(message);
    rememberGroupMessage(message);

    const chatId = message.key?.remoteJid;
    const messageId = message.key?.id;
    const senderJid = message.key?.participant ?? chatId;
    if (!chatId || !messageId || STATUS_JIDS.has(chatId)) return;

    if (message.key?.fromMe) return;

    const dedupKey = `${chatId}:${messageId}`;
    if (seen.has(dedupKey)) return;
    seen.set(dedupKey, Date.now());

    repositories.users.upsert({ jid: senderJid, pushName: message.pushName ?? null, isBot: false });

    try { await handleAfkState(socket, message, chatId, senderJid); }
    catch (error) { logger.debug('AFK handler failed', { error: error?.message ?? String(error) }); }

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
      resolveGroupMessage,
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
      repositories.commands.increment(command.name, senderJid);

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

  async function handleDeletedMessages(socket, keys) {
    for (const key of keys ?? []) {
      const jid = key?.remoteJid;
      if (!jid?.endsWith('@g.us')) continue;
      const settings = antidelete.get(jid);
      if (!settings.enabled) continue;

      const original = resolveGroupMessage(key);
      if (!original) continue;

      const destination = settings.destination || jid;
      const sender = original.key?.participant ?? key.participant ?? 'unknown';
      const info = [
        '🗑️ *ANTI-DELETE*',
        `Pengirim: @${String(sender).split('@')[0]}`,
        `ID Pesan: ${key.id ?? 'unknown'}`,
        `Waktu: ${new Date().toLocaleString('id-ID')}`,
      ].join('\n');

      try {
        await socket.sendMessage(destination, {
          text: info,
          mentions: sender && sender.includes('@') ? [sender] : [],
        });
        await socket.sendMessage(destination, { forward: original, force: true });
      } catch (error) {
        logger.error(`Error anti-delete = ${error?.message ?? String(error)}`);
      }
    }
  }

  async function handleParticipantsUpdate(socket, event) {
    if (!event?.id?.endsWith('@g.us') || !Array.isArray(event.participants) || !event.participants.length) return;

    const subject = await socket.groupMetadata(event.id).then((m) => m.subject).catch(() => 'Group');
    const action = event.action;
    if (action !== 'add' && action !== 'remove') return;

    const settingKey = action === 'add' ? 'group.welcome' : 'group.left';
    const raw = repositories.settings.get('group', event.id, settingKey, null);
    let settings = null;
    try { settings = raw ? JSON.parse(raw) : null; } catch { settings = null; }
    if (!settings?.enabled) return;

    for (const participant of event.participants) {
      const jid = participant?.id ?? participant;
      if (!jid) continue;
      const template = settings.text || (action === 'add'
        ? 'Selamat datang di *{group}*, @user!'
        : 'Sampai jumpa dari *{group}*, @user!');

      const text = template
        .replaceAll('{group}', subject)
        .replaceAll('{user}', `@${String(jid).split('@')[0]}`);

      try {
        await socket.sendMessage(event.id, { text, mentions: [jid] });
      } catch (error) {
        logger.error(`Error ${action === 'add' ? 'welcome' : 'left'} = ${error?.message ?? String(error)}`);
      }
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

    socket.ev.on('messages.delete', async (event) => {
      try {
        const keys = Array.isArray(event?.keys) ? event.keys : [];
        await handleDeletedMessages(socket, keys);
      } catch (error) {
        logger.error(`Error anti-delete = ${error?.message ?? String(error)}`);
      }
    });

    socket.ev.on('group-participants.update', async (event) => {
      try { await handleParticipantsUpdate(socket, event); }
      catch (error) { logger.error(`Error group participants = ${error?.message ?? String(error)}`); }
    });

    socket.ev.on('messages.update', () => {});
    socket.ev.on('messages.reaction', () => {});
    socket.ev.on('message-receipt.update', () => {});
    socket.ev.on('presence.update', () => {});
    socket.ev.on('groups.upsert', () => {});
    socket.ev.on('groups.update', () => {});
    socket.ev.on('connection.update', async ({ connection }) => {
      if (connection === 'open' && config.autoOnline) {
        try { await socket.sendPresenceUpdate('available'); }
        catch (error) { logger.debug('Presence update failed', { error: error?.message ?? String(error) }); }
      }
    });
  }

  return Object.freeze({ attach, handleMessage });
}
