const KEY = 'group.antidelete';

function parse(raw) {
  if (!raw) return { enabled: false, destination: null, ttl: 1800000 };
  try {
    const value = JSON.parse(raw);
    return {
      enabled: Boolean(value.enabled),
      destination: typeof value.destination === 'string' && value.destination ? value.destination : null,
      ttl: Number.isFinite(value.ttl) ? Math.min(Math.max(value.ttl, 60000), 3600000) : 1800000,
    };
  } catch {
    return { enabled: false, destination: null, ttl: 1800000 };
  }
}

export function createAntideleteService(repositories) {
  function get(jid) {
    return parse(repositories.settings.get('group', jid, KEY, null));
  }

  function set(jid, value) {
    const current = get(jid);
    const next = { ...current, ...value };
    repositories.settings.set('group', jid, KEY, JSON.stringify(next));
    return next;
  }

  return Object.freeze({ get, set });
}
