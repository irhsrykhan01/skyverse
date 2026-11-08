function getGroupContext(context) {
  if (!context.isGroup) throw new Error('Command ini hanya dapat digunakan di group.');
  return context;
}

function digitsOnly(value) {
  return String(value ?? '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function normalizeMention(value) {
  const input = String(value ?? '').trim();
  if (!input) return null;
  if (/^\d{7,15}@(s\.whatsapp\.net|lid)$/.test(input)) return input;
  const digits = digitsOnly(input);
  return /^\d{7,15}$/.test(digits) ? `${digits}@s.whatsapp.net` : null;
}

function getMentionedJids(message) {
  const content = message?.message ?? message;
  const contextInfo = content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo;
  return Array.isArray(contextInfo?.mentionedJid) ? contextInfo.mentionedJid : [];
}

function participantJids(participant) {
  return [...new Set([participant?.id, participant?.pn, participant?.lid].filter(Boolean).map(String))];
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
      const ids = participantJids(item);
      return (direct && ids.includes(direct))
        || (numeric && ids.some((id) => digitsOnly(id) === numeric));
    });

    if (participant) {
      const jid = participant.id ?? participant.lid ?? participant.pn;
      if (jid) resolved.push(String(jid));
      continue;
    }

    if (direct) resolved.push(direct);
  }

  return [...new Set(resolved)];
}

function describeGroupOperationError(error, action) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  if (message.includes('not-authorized') || message.includes('forbidden') || message.includes('401') || message.includes('403')) {
    return 'WhatsApp menolak tindakan ini. Pastikan bot admin dan target bukan admin grup.';
  }
  if (message.includes('internal-server-error')) {
    return `WhatsApp menolak operasi ${action}. Pastikan bot admin dan target masih menjadi anggota grup.`;
  }
  return `Gagal ${action} member: ${error?.message ?? String(error)}`;
}

function accountIds(participant) {
  return new Set(participantJids(participant).map((value) => value.split('@')[0].split(':')[0]));
}

function canonicalMention(participant) {
  const addressJid = [participant?.id, participant?.lid, participant?.pn].filter(Boolean).map(String)[0];
  const displayJid = [participant?.pn, participant?.id, participant?.lid]
    .filter(Boolean)
    .map(String)
    .find((value) => value.endsWith('@s.whatsapp.net'))
    ?? addressJid;
  if (!addressJid || !displayJid) return null;
  const local = displayJid.split('@')[0].split(':')[0];
  if (!local) return null;
  return { jid: addressJid, token: `@${local}` };
}

export function createGroupService() {
  async function metadata(context) {
    const ctx = getGroupContext(context);
    return ctx.getGroupMetadata();
  }

  async function assertBotAdmin(ctx, action) {
    const capability = await ctx.capabilities.check(ctx.chatId);
    if (!capability.known) {
      throw new Error('Status admin bot tidak dapat dipastikan. Pastikan bot sudah menjadi admin grup, lalu coba lagi.');
    }
    if (!capability.isAdmin) {
      throw new Error(`Bot belum menjadi admin grup untuk ${action}.`);
    }
    return capability.metadata ?? metadata(ctx);
  }

  async function add(context) {
    const ctx = getGroupContext(context);
    await assertBotAdmin(ctx, 'menambahkan anggota');
    const jids = await resolveTargetJids(ctx);
    if (!jids.length) throw new Error(`Tag nomor valid atau isi nomor setelah ${ctx.config.prefix}add.`);
    try {
      const result = await ctx.socket.groupParticipantsUpdate(ctx.chatId, jids, 'add');
      const failures = Array.isArray(result)
        ? result.filter((item) => item?.status && !['200', '201'].includes(String(item.status)))
        : [];
      if (failures.length) {
        throw new Error(failures.map((item) => `${item.jid ?? 'member'}: ${item.status}`).join('; '));
      }
      return result;
    } catch (error) {
      throw new Error(describeGroupOperationError(error, 'menambahkan'));
    }
  }

  async function kick(context) {
    const ctx = getGroupContext(context);
    const group = await assertBotAdmin(ctx, 'mengeluarkan anggota');
    const jids = await resolveTargetJids(ctx);
    if (!jids.length) throw new Error(`Tag anggota atau isi nomor setelah ${ctx.config.prefix}kick.`);

    const participants = group?.participants ?? [];
    const targets = jids.map((jid) => participants.find((item) => participantJids(item).includes(String(jid)))).filter(Boolean);
    if (targets.length !== jids.length) throw new Error('Sebagian target tidak ditemukan sebagai anggota grup.');

    const botIds = accountIds({ id: ctx.socket.user?.id, pn: ctx.socket.user?.pn, lid: ctx.socket.user?.lid });
    const senderIds = accountIds({ id: ctx.senderJid, pn: ctx.senderPhoneJid });
    if (targets.some((target) => {
      const ids = accountIds(target);
      return [...ids].some((id) => botIds.has(id) || senderIds.has(id));
    })) {
      throw new Error('Target kick tidak boleh merupakan bot atau pengirim command.');
    }
    if (targets.some((target) => ['admin', 'superadmin'].includes(String(target.admin ?? '').toLowerCase())
      || target.isAdmin === true || target.isSuperAdmin === true)) {
      throw new Error('Target adalah admin grup. Kick hanya dapat dilakukan pada anggota biasa.');
    }

    const validMembers = [...new Set(targets.map((item) => item.id ?? item.lid ?? item.pn).filter(Boolean).map(String))];
    if (validMembers.length !== targets.length) throw new Error('ID WhatsApp salah satu target tidak tersedia.');

    try {
      const result = await ctx.socket.groupParticipantsUpdate(ctx.chatId, validMembers, 'remove');
      if (!Array.isArray(result) || result.length !== validMembers.length) {
        throw new Error('WhatsApp tidak memberikan status untuk semua target. Periksa daftar anggota grup sebelum mengulangi command.');
      }
      const failures = result.filter((item) => String(item?.status ?? '') !== '200');
      if (failures.length) {
        throw new Error(failures.map((item) => {
          const reason = item?.content?.attrs?.error ?? item?.status ?? 'unknown';
          return `${item?.jid ?? 'member'}: ${reason}`;
        }).join('; '));
      }
      return Object.freeze({ removed: result.length });
    } catch (error) {
      throw new Error(describeGroupOperationError(error, 'mengeluarkan'));
    }
  }

  async function inviteLink(context) {
    const ctx = getGroupContext(context);
    const code = await ctx.socket.groupInviteCode(ctx.chatId);
    if (!code) throw new Error('Link grup tidak tersedia saat ini.');
    return `https://chat.whatsapp.com/${code}`;
  }

  async function tagAll(context, text = '') {
    const ctx = getGroupContext(context);
    const group = await metadata(ctx);
    const seen = new Set();
    const mentions = [];

    for (const participant of group?.participants ?? []) {
      const target = canonicalMention(participant);
      if (!target) continue;
      const aliases = participantJids(participant).map((jid) => jid.split('@')[0].split(':')[0]);
      if (aliases.some((alias) => seen.has(alias))) continue;
      aliases.forEach((alias) => seen.add(alias));
      mentions.push(target);
    }

    if (!mentions.length) throw new Error('Tidak ada anggota grup yang bisa di-mention.');
    const body = String(text).trim() || '📢 Tag seluruh anggota:';

    // Send small batches so every @token remains paired with its actual JID.
    const batchSize = 20;
    for (let index = 0; index < mentions.length; index += batchSize) {
      const batch = mentions.slice(index, index + batchSize);
      const messageText = index === 0
        ? `${body}\n\n${batch.map((item) => item.token).join(' ')}`
        : batch.map((item) => item.token).join(' ');
      await ctx.socket.sendMessage(ctx.chatId, {
        text: messageText,
        mentions: batch.map((item) => item.jid),
      });
    }
  }

  async function hideTag(context, text = '') {
    const ctx = getGroupContext(context);
    const group = await metadata(ctx);
    const participants = [...new Set((group?.participants ?? []).map((item) => item.id ?? item.lid ?? item.pn).filter(Boolean))];
    if (!participants.length) throw new Error('Tidak ada anggota grup yang bisa di-mention.');
    const body = String(text).trim() || '\u200e';
    await ctx.socket.sendMessage(ctx.chatId, { text: body, mentions: participants });
  }

  return Object.freeze({ metadata, add, kick, inviteLink, tagAll, hideTag });
}
