function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function valuesOf(...values) {
  return values.filter(Boolean).map(String).flatMap((value) => [value, digitsOnly(value)]).filter(Boolean);
}

function identityCandidates(socket) {
  const user = socket?.user ?? {};
  return [...new Set(valuesOf(user.id, user.lid, user.pn, user.phoneNumber, user.jid))];
}

function participantCandidates(participant) {
  return [...new Set(valuesOf(participant?.id, participant?.pn, participant?.lid, participant?.phoneNumber))];
}

function sameAccount(socket, participant) {
  const mine = identityCandidates(socket);
  const theirs = participantCandidates(participant);
  return mine.some((id) => theirs.includes(id));
}

function roleFromParticipant(participant) {
  if (!participant) return null;
  if (participant.admin === 'superadmin' || participant.isSuperAdmin) return 'owner';
  if (participant.admin === 'admin' || participant.isAdmin) return 'admin';
  return 'member';
}

export function createCapabilityEngine(socket) {
  async function group(jid) {
    if (!jid?.endsWith('@g.us')) return Object.freeze({ type: 'unknown', role: null, isAdmin: false, known: false });

    const metadata = await socket.groupMetadata(jid);
    const participant = (metadata?.participants ?? []).find((item) => sameAccount(socket, item));
    const role = roleFromParticipant(participant);

    return Object.freeze({
      type: metadata?.isCommunity ? 'community' : 'group',
      role,
      isAdmin: role === 'admin' || role === 'owner',
      isOwner: role === 'owner',
      known: Boolean(participant),
      metadata,
      participant: participant ?? null,
    });
  }

  async function channel(jid) {
    if (!jid?.endsWith('@newsletter') || typeof socket.newsletterMetadata !== 'function') {
      return Object.freeze({ type: 'channel', role: null, isAdmin: false, known: false });
    }

    const metadata = await socket.newsletterMetadata('jid', jid);
    const role = String(
      metadata?.viewer_metadata?.role
      ?? metadata?.viewerMetadata?.role
      ?? metadata?.role
      ?? '',
    ).toUpperCase();
    const normalizedRole = role === 'OWNER' ? 'owner' : role === 'ADMIN' ? 'admin' : role || 'member';

    return Object.freeze({
      type: 'channel',
      role: normalizedRole,
      isAdmin: normalizedRole === 'admin' || normalizedRole === 'owner',
      isOwner: normalizedRole === 'owner',
      known: Boolean(role),
      metadata,
    });
  }

  async function check(jid) {
    if (jid?.endsWith('@g.us')) return group(jid);
    if (jid?.endsWith('@newsletter')) return channel(jid);
    return Object.freeze({ type: 'private', role: 'member', isAdmin: false, isOwner: false, known: true });
  }

  async function requireAdmin(jid) {
    const result = await check(jid);
    if (['group', 'community', 'channel'].includes(result.type) && result.known && !result.isAdmin) {
      throw new Error(`Bot bukan admin di ${result.type}.`);
    }
    return result;
  }

  return Object.freeze({ check, group, channel, requireAdmin });
}
