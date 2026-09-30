import assert from 'node:assert/strict';
import { ProgressionCore } from '../progression/core.js';

const users = new Map();
const achievements = new Map();
const quests = new Map();
const economyTransactions = [{ user_jid: 'smoke@lid', type: 'credit', amount: 1000 }];
const database = {
  get(sql, params = []) {
    const [jid, id, period] = params;
    if (sql.includes('FROM users')) return users.get(jid) ?? { xp: 0, last_active_at: 0 };
    if (sql.includes('user_achievements')) return achievements.get(`${jid}:${id}`) ? { unlocked_at: achievements.get(`${jid}:${id}`) } : undefined;
    if (sql.includes('quest_progress')) return quests.get(`${jid}:${id}:${period}`) ?? undefined;
    if (sql.includes('SUM(amount)')) return { total: economyTransactions.filter((row) => row.user_jid === jid).reduce((sum, row) => sum + row.amount, 0) };
    return undefined;
  },
  all() { return []; },
  exec(sql, params = []) {
    if (sql.includes('user_achievements')) achievements.set(`${params[0]}:${params[1]}`, params[2]);
    if (sql.includes('quest_progress') && sql.includes('INSERT')) quests.set(`${params[0]}:${params[1]}:${params[2]}`, { progress: params[3], completed_at: params[4], claimed_at: params[5] ?? null });
    if (sql.includes('UPDATE quest_progress')) { const key = `${params[1]}:${params[2]}:${params[3]}`; const row = quests.get(key); if (row) row.claimed_at = params[0]; }
  },
  transaction(callback) { return callback(); },
};

const profile = {
  ensureUser(jid) {
    if (!users.has(jid)) users.set(jid, { jid, xp: 0, coins: 100, last_active_at: 0, daily_streak: 0, is_premium: 0, created_at: Date.now(), push_name: 'Smoke' });
    return users.get(jid);
  },
  getProfile(jid) {
    const user = this.ensureUser(jid);
    const level = user.xp >= 23100 ? 22 : user.xp >= 19000 ? 20 : user.xp >= 1000 ? 5 : user.xp >= 300 ? 3 : user.xp >= 100 ? 2 : 1;
    return { jid, xp: user.xp, level };
  },
  addXp(jid, amount) { const user = this.ensureUser(jid); user.xp += amount; return { ok: true, added: amount, level: this.getProfile(jid).level }; },
};

const progression = new ProgressionCore({ database, profile });
const jid = 'smoke@lid';
progression.ensureUser(jid);
const first = progression.processEvent(jid, 'daily');
assert.equal(first.count, 1, 'First daily achievement should unlock.');
const coin = progression.processEvent(jid, 'reward_total');
assert.equal(coin.count, 1, 'Coin Hunter should unlock at 1000 reward total.');
const changed = progression.progressQuest(jid, 'daily', 1, Date.now());
assert.equal(changed.length, 1, 'Daily quest should progress.');
assert.equal(changed[0].completed, true, 'Daily quest should complete at target.');
const claim = progression.claimQuest(jid, 'daily_claim', Date.now());
assert.equal(claim.ok, true, 'Completed quest should be claimable.');
assert.equal(claim.xp, 25, 'Quest XP reward should be 25.');
console.log('Progression smoke test passed.');
