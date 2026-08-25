const SCOPE = 'group-user';
const KEY = 'warnings';

function warningKey(groupJid, userJid) {
  return `${groupJid}:${userJid}`;
}

function read(repository, groupJid, userJid) {
  const raw = repository.settings.get(SCOPE, warningKey(groupJid, userJid), KEY, '0');
  const count = Number.parseInt(raw, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function write(repository, groupJid, userJid, count) {
  repository.settings.set(SCOPE, warningKey(groupJid, userJid), KEY, String(Math.max(0, count)));
}

export function createGroupWarningService(repositories) {
  return Object.freeze({
    get(groupJid, userJid) {
      return read(repositories, groupJid, userJid);
    },
    add(groupJid, userJid) {
      const count = read(repositories, groupJid, userJid) + 1;
      write(repositories, groupJid, userJid, count);
      return count;
    },
    remove(groupJid, userJid) {
      const count = Math.max(0, read(repositories, groupJid, userJid) - 1);
      write(repositories, groupJid, userJid, count);
      return count;
    },
    reset(groupJid, userJid) {
      write(repositories, groupJid, userJid, 0);
      return 0;
    },
  });
}
