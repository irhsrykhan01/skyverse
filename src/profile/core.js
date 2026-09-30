import { profileConfig, levelProgress } from './config.js';

function integer(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) && Number.isInteger(number) ? number : fallback; }
function cleanBio(value) { return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim(); }

export class ProfileCore {
  constructor({ database, repositories, logger = null } = {}) {
    if (!database || !repositories?.users) throw new Error('ProfileCore membutuhkan database dan repositories.users.');
    this.database = database; this.repositories = repositories; this.logger = logger;
  }
  ensureUser(jid, options = {}) { if (!jid) throw new Error('Profile user ID wajib diisi.'); return this.repositories.users.upsert({ jid, ...options }).user; }
  getProfile(jid, options = {}) {
    const user = this.ensureUser(jid, options);
    const profile = this.database.get('SELECT jid, xp, bio, last_active_at FROM users WHERE jid = ?', [jid]) ?? { jid, xp: 0, bio: null, last_active_at: 0 };
    const progress = levelProgress(profile.xp);
    return Object.freeze({ jid, number: user.number ?? null, name: user.push_name ?? 'SkyWalker', bio: profile.bio ?? null, coins: Math.max(0, integer(user.coins)), xp: progress.currentXp, level: progress.level, title: progress.title, progress: progress.progress, needed: progress.needed, percent: progress.percent, streak: Math.max(0, integer(user.daily_streak)), premium: Boolean(user.is_premium), createdAt: integer(user.created_at) });
  }
  setBio(jid, bio, options = {}) {
    this.ensureUser(jid, options); const value = cleanBio(bio);
    if (value.length > profileConfig.profile.maxBioLength) return { ok: false, reason: 'too_long', maxLength: profileConfig.profile.maxBioLength };
    this.database.exec('UPDATE users SET bio = ?, updated_at = ? WHERE jid = ?', [value || null, Date.now(), jid]);
    return { ok: true, bio: value || null };
  }
  addXp(jid, amount, source = 'activity', now = Date.now(), options = {}) {
    this.ensureUser(jid, options);
    const requested = Math.max(0, Math.min(profileConfig.xp.maxGainPerAction, integer(amount)));
    if (!requested) return { ok: false, reason: 'invalid_amount', added: 0, ...this.getProgress(jid) };
    const bypassCooldown = String(source).startsWith('quest:');
    let result = null;
    this.database.transaction(() => {
      const user = this.database.get('SELECT xp, last_active_at FROM users WHERE jid = ?', [jid]);
      const lastActiveAt = Math.max(0, integer(user?.last_active_at));
      if (!bypassCooldown && now - lastActiveAt < profileConfig.xp.activityCooldownMs) {
        const progress = levelProgress(user?.xp ?? 0);
        result = { ok: false, reason: 'cooldown', added: 0, cooldownRemaining: profileConfig.xp.activityCooldownMs - (now - lastActiveAt), ...progress };
        return;
      }
      const before = Math.max(0, integer(user?.xp)); const after = before + requested;
      this.database.exec('UPDATE users SET xp = ?, last_active_at = ?, updated_at = ? WHERE jid = ?', [after, now, now, jid]);
      this.database.exec(`INSERT INTO xp_transactions (user_jid, amount, xp_after, source, created_at) VALUES (?, ?, ?, ?, ?)`, [jid, requested, after, source, now]);
      const previous = levelProgress(before); const progress = levelProgress(after);
      result = { ok: true, added: requested, xp: after, previousLevel: previous.level, level: progress.level, leveledUp: progress.level > previous.level, ...progress };
    });
    return result;
  }
  getProgress(jid) { const row = this.database.get('SELECT xp FROM users WHERE jid = ?', [jid]); return levelProgress(row?.xp ?? 0); }
  xpHistory(jid, limit = 10) { this.ensureUser(jid); return this.database.all(`SELECT amount, xp_after, source, created_at FROM xp_transactions WHERE user_jid = ? ORDER BY id DESC LIMIT ?`, [jid, Math.max(1, Math.min(50, integer(limit, 10)))]); }
  leaderboard(limit = 10) {
    const rows = this.database.all(`SELECT jid, push_name, xp, coins FROM users WHERE is_bot = 0 ORDER BY xp DESC, coins DESC, updated_at ASC LIMIT ?`, [Math.max(1, Math.min(100, integer(limit, 10)))]);
    return rows.map((row, index) => { const progress = levelProgress(row.xp); return { rank: index + 1, jid: row.jid, name: row.push_name ?? 'SkyWalker', xp: progress.currentXp, level: progress.level, title: progress.title, coins: Math.max(0, integer(row.coins)) }; });
  }
}
