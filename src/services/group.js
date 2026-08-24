function getGroupContext(context) {
  if (!context.isGroup) throw new Error('Command ini hanya dapat digunakan di group.');
  return context;
}

function normalizeMention(jid) {
  if (!jid) return null;
  return String(jid).includes('@') ? String(jid) : `${String(jid).replace(/\D/g, '')}@s.whatsapp.net`;
}

function getMentionedJids(message) {
  const contextInfo = message?.message?.extendedTextMessage?.contextInfo
    ?? message?.message?.imageMessage?.contextInfo
    ?? message?.message?.videoMessage?.contextInfo
    ?? message?.message?.documentMessage?.contextInfo;
  return Array.isArray(contextInfo?.mentionedJid) ? contextInfo.mentionedJid : [];
}

function resolveTargetJids(context) {
  const mentioned = getMentionedJids(context.message);
  if (mentioned.length) return [...new Set(mentioned.map(normalizeMention).filter(Boolean))];

  const fromArgs = context.parsed.args
    .map(normalizeMention)
    .filter(Boolean);
  return [...new Set(fromArgs)];
}

export function createGroupService() {
  async function metadata(context) {
    const ctx = getGroupContext(context);
    return ctx.getGroupMetadata();
  }

  async function add(context) {
    const ctx = getGroupContext(context);
    const jids = resolveTargetJids(ctx);
    if (!jids.length) throw new Error(`Tag nomor atau isi nomor setelah ${ctx.config.prefix}add.`);
    return ctx.socket.groupParticipantsUpdate(ctx.chatId, jids, 'add');
  }

  async function kick(context) {
    const ctx = getGroupContext(context);
    const jids = resolveTargetJids(ctx);
    if (!jids.length) throw new Error(`Tag member atau isi nomor setelah ${ctx.config.prefix}kick.`);
    return ctx.socket.groupParticipantsUpdate(ctx.chatId, jids, 'remove');
  }

  async function inviteLink(context) {
    const ctx = getGroupContext(context);
    const code = await ctx.socket.groupInviteCode(ctx.chatId);
    return `https://chat.whatsapp.com/${code}`;
  }

  async function tagAll(context, text = '') {
    const ctx = getGroupContext(context);
    const group = await metadata(ctx);
    const participants = (group.participants ?? []).map((item) => item.id).filter(Boolean);
    const body = text.trim() || 'Tag all';
    await ctx.socket.sendMessage(ctx.chatId, { text: body, mentions: participants });
  }

  async function hideTag(context, text = '') {
    const ctx = getGroupContext(context);
    const group = await metadata(ctx);
    const participants = (group.participants ?? []).map((item) => item.id).filter(Boolean);
    const body = text.trim() || '\u200e';
    await ctx.socket.sendMessage(ctx.chatId, { text: body, mentions: participants });
  }

  return Object.freeze({ metadata, add, kick, inviteLink, tagAll, hideTag });
}
