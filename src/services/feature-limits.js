const KEY = 'user.feature-limits';
const TIME_ZONE = 'Asia/Jakarta';
const LIMITED_CATEGORIES = new Set(['downloader', 'sticker', 'media', 'sticker-media', 'tools']);

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dayKey(now = Date.now()) {
  return dayFormatter.format(new Date(now));
}

function nextResetAt(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(values.year, values.month - 1, values.day + 1) - 7 * 60 * 60 * 1000;
}

function safeRecord(raw, today) {
  if (!raw) return { day: today, features: {} };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.day !== today || !parsed.features || typeof parsed.features !== 'object' || Array.isArray(parsed.features)) {
      return { day: today, features: {} };
    }
    const features = {};
    for (const [name, count] of Object.entries(parsed.features)) {
      if (/^[a-z0-9_-]{1,64}$/.test(name) && Number.isInteger(count) && count > 0) {
        features[name] = count;
      }
    }
    return { day: today, features };
  } catch {
    return { day: today, features: {} };
  }
}

export function resolveDailyFeatureLimit(command, defaultLimit = 10) {
  if (command?.dailyLimit === false) return 0;
  if (Number.isInteger(command?.dailyLimit) && command.dailyLimit >= 0) return command.dailyLimit;
  return LIMITED_CATEGORIES.has(String(command?.category ?? '').toLowerCase())
    ? Math.max(1, Math.floor(Number(defaultLimit) || 10))
    : 0;
}

export function createFeatureLimitService(repositories, { defaultLimit = 10 } = {}) {
  if (!repositories?.settings?.get || !repositories?.settings?.set) {
    throw new Error('FeatureLimitService membutuhkan repositories.settings.');
  }

  function read(userJid, now = Date.now()) {
    if (!userJid) throw new Error('User ID untuk limit wajib diisi.');
    const today = dayKey(now);
    const raw = repositories.settings.get('user', userJid, KEY, null);
    return safeRecord(raw, today);
  }

  function write(userJid, record) {
    repositories.settings.set('user', userJid, KEY, JSON.stringify(record));
  }

  function snapshot(userJid, commands, now = Date.now()) {
    const record = read(userJid, now);
    return commands
      .map((command) => {
        const limit = resolveDailyFeatureLimit(command, defaultLimit);
        if (!limit) return null;
        const used = Math.min(limit, record.features[command.name] ?? 0);
        return Object.freeze({
          name: command.name,
          category: command.category,
          limit,
          used,
          remaining: Math.max(0, limit - used),
        });
      })
      .filter(Boolean)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  function consume(userJid, command, now = Date.now()) {
    const limit = resolveDailyFeatureLimit(command, defaultLimit);
    if (!limit) return { ok: true, limited: false, used: 0, limit: 0, remaining: null, reservation: null };

    const record = read(userJid, now);
    const used = record.features[command.name] ?? 0;
    if (used >= limit) {
      return {
        ok: false,
        limited: true,
        used,
        limit,
        remaining: 0,
        resetAt: nextResetAt(now),
        reservation: null,
      };
    }

    record.features[command.name] = used + 1;
    write(userJid, record);
    return {
      ok: true,
      limited: true,
      used: used + 1,
      limit,
      remaining: limit - used - 1,
      reservation: Object.freeze({ userJid, feature: command.name, day: record.day }),
    };
  }

  function refund(reservation) {
    if (!reservation?.userJid || !reservation?.feature || !reservation?.day) return false;
    const today = dayKey(Date.now());
    if (today !== reservation.day) return false;
    const record = read(reservation.userJid);
    const used = record.features[reservation.feature] ?? 0;
    if (!used) return false;
    if (used <= 1) delete record.features[reservation.feature];
    else record.features[reservation.feature] = used - 1;
    write(reservation.userJid, record);
    return true;
  }

  return Object.freeze({ snapshot, consume, refund, defaultLimit });
}
