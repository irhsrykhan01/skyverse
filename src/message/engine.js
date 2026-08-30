import { createMessageContext } from './context.js';
import { parseIncomingMessage } from './parser.js';
import { createAfkService } from '../services/afk.js';
import { createAntideleteService } from '../services/antidelete.js';
import { getMessageText } from './parser.js';
import { isBombReply, guessBomb, updateBombMessage } from '../games/' + 'bomb.js';

const STATUS_JIDS = new Set(['status@broadcast']);
const PERMISSION_ORDER = Object.freeze({ user: 0, admin: 1, owner: 2 });
const NEWSLETTER_META_TTL = 6 * 60 * 60 * 1000;
const GROUP_MESSAGE_TTL = 30 * 60 * 1000;
const MAX_GROUP_CACHED_MESSAGES = 250;
const USER_INPUT_PREFIXES = ['USER_INPUT:', 'USER_INPUT_MEDIA:'];

function displaySender(jid, phoneJid, chatId) {
  if (chatId?.endsWith('@newsletter')) return 'Channel';
  if (chatId?.endsWith('@broadcast')) return 'Broadcast';
  const rawPhone = String(phoneJid || '').split('@')[0].replace(/^\+/, '').replace(/\D/g, '');
  if (rawPhone) return `+${rawPhone}`;
  if (!jid) return 'unknown';
  const rawJid = String(jid);
  if (rawJid.endsWith('@lid') || rawJid.endsWith('@hosted.lid')) return '[LID]';
  return `+${rawJid.replace(/@(s\.whatsapp\.net|g\.us|newsletter|broadcast)$/i, '').replace(/^\+/, '')}`;
}

function errorCode(error) { return error?.output?.statusCode ?? error?.statusCode ?? error?.status ?? error?.code ?? null; }
function getContextInfo(message) {
  const content = message?.message ?? message;
  return content?.extendedTextMessage?.contextInfo ?? content?.imageMessage?.contextInfo ?? content?.videoMessage?.contextInfo
    ?? content?.ptvMessage?.contextInfo ?? content?.audioMessage?.contextInfo ?? content?.stickerMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo ?? null;
}
function getMentionedJids(message) {
  const mentioned = getContextInfo(message)?.mentionedJid;
  return Array.isArray(mentioned) ? mentioned.filter(Boolean).map(String) : [];
}
function getPushName(message, jid) { return message?.pushName || jid?.split('@')[0] || 'User'; }
function userInputMessage(error) {
  const message = String(error?.message ?? '');
  const prefix = USER_INPUT_PREFIXES.find((item) => message.startsWith(item));
  return prefix ? message.slice(prefix.length).trim() : null;
}

export function createMessageEngine({ config, logger, identity, registry, repositories, economy, providers }) {
  const seen = new Map();
  const cooldowns = new Map();
  const newsletterMessages = new Map();
  const groupMessages = new Map();
  const lidToPn = new Map();
  const seenTtl = 60_000;
  const slowCommandDelay = 900;
  const afk = createAfkService(repositories);
  const antidelete = createAntideleteService(repositories);

  function prune() {
    const now = Date.now();
    for (const [id, timestamp] of seen) if (now - timestamp > seenTtl) seen.delete(id);
    for (const [key, until] of cooldowns) if (until <= now) cooldowns.delete(key);
    for (const [key, value] of newsletterMessages) if (value.expiresAt <= now) newsletterMessages.delete(key);
    for (const [groupJid, messages] of groupMessages) {
      for (const [id, value] of messages) if (value.expiresAt <= now) messages.delete(id);
      while (messages.size > MAX_GROUP_CACHED_MESSAGES) messages.delete(messages.keys().next().value);
      if (!messages.size) groupMessages.delete(groupJid);
    }
  }
  function rememberNewsletterMessage(message) {
    const chatId = message.key?.remoteJid;
    const messageId = message.key?.id;
    if (!chatId?.endsWith('@newsletter') || !messageId) return;
    const serverId = message.key?.server_id;
    if (!serverId) return;
    newsletterMessages.set(`${chatId}:${messageId}`, { serverId: String(serverId), participant: message.key?.participant ?? null, fromMe: Boolean(message.key?.fromMe), messageId, expiresAt: Date.now() + NEWSLETTER_META_TTL });
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
    if (!cache) { cache = new Map(); groupMessages.set(chatId, cache); }
    cache.set(messageId, { message, senderJid: message.key?.participant ?? chatId, pushName: getPushName(message, message.key?.participant ?? chatId), createdAt: Date.now(), expiresAt: Date.now() + settings.ttl });
    while (cache.size > MAX_GROUP_CACHED_MESSAGES) cache.delete(cache.keys().next().value);
  }
  function resolveGroupMessage(key) {
    const jid = key?.remoteJid;
    const id = key?.id;
    if (!jid?.endsWith('@g.us') || !id) return null;
    return groupMessages.get(jid)?.get(id)?.message ?? null;
  }
  async function safeReact(context, emoji) { try { await context.react(emoji); } catch (error) { logger.debug('Progress reaction failed', { emoji, error: error?.message ?? String(error) }); } }
  async function handleAfkState(socket, message, chatId, senderJid) {
    if (!senderJid || !chatId) return;
    const ownAfk = afk.get({ senderJid });
    if (ownAfk) {
      afk.clear({ senderJid });
      const elapsed = Math.max(0, Math.floor((Date.now() - ownAfk.startedAt) / 60000));
      if (elapsed > 0) await socket.sendMessage(chatId, { text: `Selamat datang kembali! AFK selama sekitar ${elapsed} menit.` });
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
    if (notices.length) await socket.sendMessage(chatId, { text: notices.join('\n'), mentions: [...new Set(mentioned)] });
  }

  async function handleMessage(socket, message) {
    if (!message?.message) return;
    prune(); rememberNewsletterMessage(message); rememberGroupMessage(message);
    const chatId = message.key?.remoteJid;
    const messageId = message.key?.id;
    const senderJid = message.key?.participant ?? chatId;
    if (!chatId || !messageId || STATUS_JIDS.has(chatId) || message.key?.fromMe) return;
    const dedupKey = `${chatId}:${messageId}`;
    if (seen.has(dedupKey)) return;
    seen.set(dedupKey, Date.now());

    const senderPhoneJid = message.key?.participantAlt ?? message.key?.remoteJidAlt ?? lidToPn.get(senderJid) ?? null;
    repositories.users.upsert({ jid: senderJid, phoneJid: senderPhoneJid, pushName: message.pushName ?? null, isBot: false });
    if (chatId.endsWith('@g.us')) repositories.groups.upsert({ jid: chatId });
    try { await handleAfkState(socket, message, chatId, senderJid); } catch (error) { logger.debug('AFK handler failed', { error: error?.message ?? String(error) }); }
    if (config.autoRead) try { await socket.readMessages([message.key]); } catch (error) { logger.debug('Read receipt failed', { error: error?.message ?? String(error) }); }

    const plainText = getMessageText(message);
    const quotedContext = getContextInfo(message);
    const quotedStanzaId = quotedContext?.stanzaId ?? null;
    const activeGame = quotedStanzaId ? isBombReply(senderJid, { chatId, stanzaId: quotedStanzaId }) : false;
    if (!plainText.startsWith(config.prefix) && quotedStanzaId && /^\d+$/.test(plainText) && activeGame) {
      const result = guessBomb(senderJid, plainText);
      if (!result.ok) {
        const text = result.reason === 'already_opened' ? 'Angka itu sudah dibuka! Pilih angka lain.' : 'Pilih angka 1 sampai 9.';
        await socket.sendMessage(chatId, { text }, { quoted: message });
        return;
      }
      if (result.result === 'safe') {
        economy.addCoins(senderJid, result.reward, 'game:board:win');
        const sent = await socket.sendMessage(chatId, { text: [String(result.selected) + '\uFE0F → ✅', '+' + result.reward + ' 🪙', '', 'Pilih angka berikutnya!', '', result.board, '', 'Ketikkan angka dan Reply pesan ini.'].join('\n') }, { quoted: message });
        updateBombMessage(senderJid, sent?.key?.id ?? null);
      } else {
        const wallet = economy.getWallet(senderJid);
        const penalty = Math.min(wallet.coins, result.penalty);
        if (penalty > 0) economy.spendCoins(senderJid, penalty, 'game:board:loss');
        await socket.sendMessage(chatId, { text: [String(result.selected) + '\uFE0F → 💣', '', 'BOOM!! 💥💥', '', '- ' + penalty + ' 🪙', 'Game selesai!'].join('\n') }, { quoted: message });
      }
      return;
    }

    const parsed = parseIncomingMessage(message, config.prefix);
    if (!parsed) return;
    logger.info(`Dari ${displaySender(senderJid, senderPhoneJid, chatId)} = ${parsed.raw}`);
    const command = registry.resolve(parsed.name);
    if (!command) return;

    const context = createMessageContext({ socket, message, command, registry, identity, config, parsed, providers, repositories, economy, resolveNewsletterMessage, resolveGroupMessage });
    const permission = await context.permissionLevel(command.permission);
    if ((PERMISSION_ORDER[permission] ?? 0) < (PERMISSION_ORDER[command.permission] ?? 0)) { await context.reply('Kamu tidak memiliki izin untuk menggunakan command ini.'); return; }
    if (command.cost > 0 && !context.isOwner) {
      const wallet = economy.getWallet(senderJid);
      if (wallet.coins < command.cost) { await context.reply(`Coin tidak cukup. Butuh ${command.cost} 🪙, saldo kamu ${wallet.coins} 🪙.`); return; }
    }
    if (parsed.args.length < command.minArgs || (command.maxArgs !== null && parsed.args.length > command.maxArgs)) {
      const usage = command.usage ? `${config.prefix}${command.usage}` : `${config.prefix}${command.name}`;
      await context.reply(`Format penggunaan tidak sesuai.\n\nUsage: ${usage}`); return;
    }
    let cooldownKey = null;
    if (command.cooldown > 0 && !context.isOwner) {
      cooldownKey = `${command.name}:${senderJid ?? chatId}`;
      const until = cooldowns.get(cooldownKey) ?? 0;
      if (until > Date.now()) { await context.reply(`Tunggu ${Math.ceil((until - Date.now()) / 1000)} detik sebelum memakai command ini lagi.`); return; }
      cooldowns.set(cooldownKey, Date.now() + command.cooldown);
    }

    let slowReactionTimer = null;
    let slowReactionShown = false;
    let payment = null;
    try {
      if (command.cost > 0 && !context.isOwner) {
        payment = economy.spendCoins(senderJid, command.cost, `command:${command.name}`);
        if (!payment.ok) { if (cooldownKey) cooldowns.delete(cooldownKey); await context.reply(`Coin tidak cukup. Butuh ${payment.required} 🪙, saldo kamu ${payment.balance} 🪙.`); return; }
      }
      repositories.commands.increment(command.name, senderJid);
      slowReactionTimer = setTimeout(async () => { slowReactionShown = true; await safeReact(context, '⏳'); }, slowCommandDelay);
      await command.execute(context);
      if (slowReactionShown) await safeReact(context, '✅');
      logger.info(`Bot = ${command.name} selesai`);
    } catch (error) {
      const code = errorCode(error);
      const friendly = userInputMessage(error);
      if (payment?.ok) {
        try { economy.addCoins(senderJid, payment.spent, `refund:command:${command.name}`); } catch (refundError) { logger.error(`Error refund = ${refundError?.message ?? String(refundError)}`); }
      }
      if (cooldownKey) cooldowns.delete(cooldownKey);
      logger.error(`Error${code ? ` ${code}` : ''} = ${error?.message ?? String(error)}`);
      if (slowReactionShown) await safeReact(context, '❌');
      try { await context.reply(friendly || 'Terjadi kesalahan saat menjalankan command. Coba lagi nanti.'); } catch {}
    } finally { if (slowReactionTimer) clearTimeout(slowReactionTimer); }
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
      const info = ['🗑️ *ANTI-DELETE*', `Pengirim: @${String(sender).split('@')[0]}`, `ID Pesan: ${key.id ?? 'unknown'}`, `Waktu: ${new Date().toLocaleString('id-ID')}`].join('\n');
      try { await socket.sendMessage(destination, { text: info, mentions: sender && sender.includes('@') ? [sender] : [] }); await socket.sendMessage(destination, { forward: original, force: true }); }
      catch (error) { logger.error(`Error anti-delete = ${error?.message ?? String(error)}`); }
    }
  }

  async function handleParticipantsUpdate(socket, event) {
    if (!event?.id?.endsWith('@g.us') || !Array.isArray(event.participants) || !event.participants.length) return;
    const subject = await socket.groupMetadata(event.id).then((m) => m.subject).catch(() => 'Group');
    const action = event.action;
    if (action !== 'add' && action !== 'remove') return;
    const settingKey = action === 'add' ? 'group.welcome' : 'group.left';
    const raw = repositories.settings.get('group', event.id, settingKey, null);
    let settings = null; try { settings = raw ? JSON.parse(raw) : null; } catch {}
    if (!settings?.enabled) return;
    for (const participant of event.participants) {
      const jid = participant?.id ?? participant; if (!jid) continue;
      const template = settings.text || (action === 'add' ? 'Selamat datang di *{group}*, @user!' : 'Sampai jumpa dari *{group}*, @user!');
      const text = template.replaceAll('{group}', subject).replaceAll('{user}', `@${String(jid).split('@')[0]}`);
      try { await socket.sendMessage(event.id, { text, mentions: [jid] }); } catch (error) { logger.error(`Error ${action === 'add' ? 'welcome' : 'left'} = ${error?.message ?? String(error)}`); }
    }
  }

  function attach(socket) {
    socket.ev.on('lid-mapping.update', async (mapping) => {
      const lid = mapping?.lid;
      const pn = mapping?.pn;
      if (!lid || !pn || !String(lid).endsWith('@lid') || !String(pn).endsWith('@s.whatsapp.net')) return;
      lidToPn.set(lid, pn);
      const existing = repositories.users.get(lid);
      if (existing) repositories.users.upsert({ jid: lid, phoneJid: pn, pushName: existing.push_name, isBot: Boolean(existing.is_bot) });
    });
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type && type !== 'notify') return;
      for (const message of messages ?? []) try { await handleMessage(socket, message); } catch (error) { logger.error(`Error = ${error?.message ?? String(error)}`); }
    });
    socket.ev.on('messages.delete', async (event) => { try { await handleDeletedMessages(socket, Array.isArray(event?.keys) ? event.keys : []); } catch (error) { logger.error(`Error anti-delete = ${error?.message ?? String(error)}`); } });
    socket.ev.on('group-participants.update', async (event) => { try { await handleParticipantsUpdate(socket, event); } catch (error) { logger.error(`Error group participants = ${error?.message ?? String(error)}`); } });
    socket.ev.on('messages.update', () => {});
    socket.ev.on('messages.reaction', () => {});
    socket.ev.on('message-receipt.update', () => {});
    socket.ev.on('presence.update', () => {});
    socket.ev.on('groups.upsert', () => {});
    socket.ev.on('groups.update', () => {});
    socket.ev.on('connection.update', async ({ connection }) => { if (connection === 'open' && config.autoOnline) try { await socket.sendPresenceUpdate('available'); } catch (error) { logger.debug('Presence update failed', { error: error?.message ?? String(error) }); } });
  }

  return Object.freeze({ attach, handleMessage });
}
