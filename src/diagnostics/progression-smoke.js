import assert from 'node:assert/strict';
import { ProgressionCore } from '../progression/core.js';

const users = new Map();
const achievements = new Map();
const quests = new Map();
const database = {
  get(sql, params = []) {
    const [jid, id, period] = params;
    if (sql.includes('FROM users')) return users.get(jid) ?? { xp: 0, last_active_at: 0 };
    if (sql.includes('user_achievements')) return achievements.get(`${jid}:${id}`) ? { unlocked_at: achievements.get(`${jid}:${id}`) } : undefined;
    if (sql.includes('quest_progress')) return quests.get(`${jid}:${id}:${period}`) ?? undefined;
    return undefined;
  },
  all() { return []; },
  exec(sql, params = []) {
    if (sql.includes('user_achievements')) achievements.set(`${params[0]}:${params[1]}`, params[2]);
    if (sql.includes('quest_progress') && sql.includes('INSERT')) quests.set(`${params[0]}:${params[1]}:${params[2]}`, { progress: params[3], completed_at: params[4], claimed_at: params[5] ?? null });
    if (sql.includes('UPDATE quest_progress')) {
      const key = `${params[1]}:${params[2]}:${params[3]}`;
      const row = quests.get(key);
      if (row) row.claimed_at = params[0];
    }
  },
  transaction(callback) { return callback(); },
};

const profile = {
  ensureUser(jid) {
    if (!users.has(jid)) users.set(jid, { jid, xp: 0, last_active_at: 0, push_name: 'Smoke' });
    return users.get(jid);
  },
  getProfile(jid) {
    const user = this.ensureUser(jid);
    const level = user.xp >= 23100 ? 22 : user.xp >= 19000 ? 20 : user.xp >= 1000 ? 5 : user.xp >= 300 ? 3 : user.xp >= 100 ? 2 : 1;
    return { jid, xp: user.xp, level };
  },
  addXp(jid, amount) {
    const user = this.ensureUser(jid);
    user.xp += amount;
    return { ok: true, added: amount, level: this.getProfile(jid).level };
  },
};

const progression = new ProgressionCore({ database, profile });
const jid = 'smoke@lid';
progression.ensureUser(jid);

const activity = progression.processEvent(jid, 'activity');
assert.equal(activity.count, 1, 'First activity achievement should unlock.');
const repeatedActivity = progression.processEvent(jid, 'activity');
assert.equal(repeatedActivity.count, 0, 'Activity achievement should not unlock twice.');

const changed = progression.progressQuest(jid, 'xp', 30, Date.now());
assert.equal(changed.length, 1, 'XP quest should progress.');
assert.equal(changed[0].completed, true, 'XP quest should complete at target.');

const claim = progression.claimQuest(jid, 'daily_xp', Date.now());
assert.equal(claim.ok, true, 'Completed XP quest should be claimable.');
assert.equal(claim.xp, 20, 'XP quest reward should be 20.');
console.log('Progression smoke test passed.');
