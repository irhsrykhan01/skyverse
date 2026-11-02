function getGroupContext(context) {
  if (!context.isGroup) throw new Error('Command ini hanya dapat digunakan di group.');
  return context;
}

function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeMention(jid) {
  if (!jid) return null;
  const value = String(jid).trim();
  if (value.includes('@')) return value;
  const digits = digitsOnly(value);
  if (!/^\d{7,15}$/.test(digits)) return null;
  return `${digits}@s.whatsapp.net`;
}

function getMentionedJids(message) {
  const contextInfo = message?.message?.extendedTextMessage?.contextInfo
    ?? message?.message?.imageMessage?.contextInfo
    ?? message?.message?.videoMessage?.contextInfo
    ?? message?.message?.documentMessage?.contextInfo;
  return Array.isArray(contextInfo?.mentionedJid) ? contextInfo.mentionedJid : [];
}

async function resolveTargetJids(context) {
  const metadata = await context.getGroupMetadata();
  const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];
  const mentioned = getMentionedJids(context.message);
  const rawTargets = mentioned.length ? mentioned : context.parsed.args;
  const resolved = [];

  for (const raw of rawTargets) {
    const value = String(raw ?? '').trim();
    if (!value) continue;

    const direct = normalizeMention(value);
    const numeric = digitsOnly(value);
    const participant = participants.find((item) => {
      const ids = [item?.id, item?.pn, item?.lid].filter(Boolean).map(String);
      if (direct && ids.includes(direct)) return true;
      return numeric && ids.some((id) => digitsOnly(id) === numeric);
    });

    if (participant?.id) {
      resolved.push(participant.id);
      continue;
    }

    if (direct && direct.endsWith('@s.whatsapp.net')) resolved.push(direct);
  }

  return [...new Set(resolved)];
}

function describeGroupOperationError(error, action) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  if (message.includes('not-authorized') || message.includes('forbidden') || message.includes('401')) {
    return 'Bot tidak memiliki izin admin untuk melakukan tindakan ini.';
  }
  if (message.includes('internal-server-error')) {
    return `WhatsApp menolak operasi ${action}. Pastikan bot adalah admin dan target masih merupakan anggota group.`;
  }
  return `Gagal ${action} member: ${error?.message ?? String(error)}`;
}

export function createGroupService() {
  async function metadata(context) {
    const ctx = getGroupContext(context);
    return ctx.getGroupMetadata();
  }

  async function assertBotAdmin(ctx, action) {
    const capability = await ctx.capabilities.check(ctx.chatId);
    if (!capability.known) {
      throw new Error('Status admin bot tidak dapat dipastikan. Pastikan bot sudah menjadi admin group, lalu coba lagi.');
    }
    if (!capability.isAdmin) {
      throw new Error(`Bot belum menjadi admin group untuk ${action}.`);
    }
    return capability.metadata ?? metadata(ctx);
  }

  async function add(context) {
    const ctx = getGroupContext(context);
    await assertBotAdmin(ctx, 'menambahkan member');
    const jids = await resolveTargetJids(ctx);
    if (!jids.length) throw new Error(`Tag nomor valid atau isi nomor setelah ${ctx.config.prefix}add.`);
    try {
      return await ctx.socket.groupParticipantsUpdate(ctx.chatId, jids, 'add');
    } catch (error) {
      throw new Error(describeGroupOperationError(error, 'menambahkan'));
    }
  }

  async function kick(context) {
    const ctx = getGroupContext(context);
    const group = await assertBotAdmin(ctx, 'mengeluarkan member');
    const jids = await resolveTargetJids(ctx);
    if (!jids.length) throw new Error(`Tag member atau isi nomor setelah ${ctx.config.prefix}kick.`);

    const participants = group?.participants ?? [];
    const targets = jids.map((jid) => participants.find((item) =>
      [item?.id, item?.pn, item?.lid].filter(Boolean).map(String).includes(String(jid))
    )).filter(Boolean);
    if (!targets.length) throw new Error('Target tidak ditemukan sebagai anggota group.');

    const accountIds = (participant) => new Set(
      [participant?.id, participant?.pn, participant?.lid].filter(Boolean).map((value) => String(value).split(':')[0])
    );
    const botIds = accountIds({ id: ctx.socket.user?.id, pn: ctx.socket.user?.pn, lid: ctx.socket.user?.lid });
    const senderIds = accountIds({ id: ctx.senderJid, pn: ctx.senderPhoneJid });
    if (targets.some((target) => {
      const ids = accountIds(target);
      return [...ids].some((id) => botIds.has(id) || senderIds.has(id));
    })) {
      throw new Error('Target kick tidak boleh merupakan bot atau pengirim command.');
    }

    const validMembers = [...new Set(targets.map((item) => item.id).filter(Boolean))];
    try {
      const result = await ctx.socket.groupParticipantsUpdate(ctx.chatId, validMembers, 'remove');
      const failed = Array.isArray(result) ? result.filter((item) => item?.status && !['200', '201'].includes(String(item.status))) : [];
      if (failed.length) {
        throw new Error(failed.map((item) => `${item.jid ?? 'member'}: ${item.content?.[0]?.attrs?.reason ?? item.status}`).join('; '));
      }
      return result;
    } catch (error) {
      throw new Error(describeGroupOperationError(error, 'mengeluarkan'));
    }
  }

  async function inviteLink(context) {
    const ctx = getGroupContext(context);
    const code = await ctx.socket.groupInviteCode(ctx.chatId);
    if (!code) throw new Error('Link group tidak tersedia saat ini.');
    return `https://chat.whatsapp.com/${code}`;
  }

  async function tagAll(context, text = '') {
    const ctx = getGroupContext(context);
    const group = await metadata(ctx);
    const participants = (group?.participants ?? []).map((item) => item.id).filter(Boolean);
    if (!participants.length) throw new Error('Tidak ada anggota group yang bisa di-mention.');
    const unique = [...new Set(participants)];
    const body = String(text).trim() || 'Tag all';
    const visibleMentions = unique.map((jid) => `@${String(jid).split('@')[0]}`).join('\\n');
    await ctx.socket.sendMessage(ctx.chatId, {
      text: `${body}\\n\\n${visibleMentions}`,
      mentions: unique,
    });
  }

  async function hideTag(context, text = '') {
    const ctx = getGroupContext(context);
    const group = await metadata(ctx);
    const participants = (group?.participants ?? []).map((item) => item.id).filter(Boolean);
    if (!participants.length) throw new Error('Tidak ada anggota group yang bisa di-mention.');
    const body = String(text).trim() || '\u200e';
    await ctx.socket.sendMessage(ctx.chatId, { text: body, mentions: [...new Set(participants)] });
  }

  return Object.freeze({ metadata, add, kick, inviteLink, tagAll, hideTag });
}
