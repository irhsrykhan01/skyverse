const KEY = 'user.afk';

export function createAfkService(repositories) {
  function get(context) {
    const raw = repositories.settings.get('user', context.senderJid, KEY, null);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.enabled ? parsed : null;
    } catch {
      return null;
    }
  }

  function set(context, reason = '') {
    const value = {
      enabled: true,
      reason: String(reason).trim() || 'AFK',
      startedAt: Date.now(),
    };
    repositories.settings.set('user', context.senderJid, KEY, JSON.stringify(value));
    return value;
  }

  function clear(context) {
    repositories.settings.set('user', context.senderJid, KEY, JSON.stringify({ enabled: false }));
  }

  return Object.freeze({ get, set, clear });
}
