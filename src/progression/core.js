import { achievementConfig, progressionLimits, questConfig } from './config.js';

function integer(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) ? n : fallback;
}

function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export class ProgressionCore {
  constructor({ database, profile, logger = null } = {}) {
    if (!database || !profile) throw new Error('ProgressionCore membutuhkan database dan ProfileCore.');
    this.database = database;
    this.profile = profile;
    this.logger = logger;
  }

  ensureUser(jid, options = {}) {
    return this.profile.ensureUser(jid, options);
  }

  achievements(jid) {
    this.ensureUser(jid);
    return Object.values(achievementConfig).map((achievement) => {
      const row = this.database.get(
        'SELECT unlocked_at FROM user_achievements WHERE user_jid = ? AND achievement_id = ?',
        [jid, achievement.id],
      );
      return { ...achievement, unlocked: Boolean(row), unlockedAt: row?.unlocked_at ?? null };
    });
  }

  unlockedAchievements(jid) {
    return this.achievements(jid).filter((achievement) => achievement.unlocked);
  }

  unlock(jid, achievementId, now = Date.now()) {
    const achievement = Object.values(achievementConfig).find((item) => item.id === achievementId);
    if (!achievement) return { ok: false, reason: 'unknown_achievement' };

    this.ensureUser(jid);
    const existing = this.database.get(
      'SELECT unlocked_at FROM user_achievements WHERE user_jid = ? AND achievement_id = ?',
      [jid, achievementId],
    );
    if (existing) return { ok: false, reason: 'already_unlocked', achievement };

    this.database.exec(
      `INSERT INTO user_achievements (user_jid, achievement_id, unlocked_at)
       VALUES (?, ?, ?)`,
      [jid, achievementId, now],
    );
    return { ok: true, achievement, unlockedAt: now };
  }

  processEvent(jid, event, value = 1, now = Date.now()) {
    this.ensureUser(jid);
    const amount = Math.max(0, Math.min(progressionLimits.maxQuestProgress, integer(value)));
    const unlocked = [];
    const profile = this.profile.getProfile(jid);

    if (event === 'activity') unlocked.push(this.unlock(jid, achievementConfig.firstSteps.id, now));
    if (event === 'daily') unlocked.push(this.unlock(jid, achievementConfig.dailyRitual.id, now));
    if (event === 'transfer') unlocked.push(this.unlock(jid, achievementConfig.socialSky.id, now));
    if (event === 'reward_total') {
      const total = this.database.get(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM economy_transactions
         WHERE user_jid = ? AND type = 'credit'`,
        [jid],
      );
      if (integer(total?.total) >= 1000) unlocked.push(this.unlock(jid, achievementConfig.coinHunter.id, now));
    }
    if (profile.level >= 5) unlocked.push(this.unlock(jid, achievementConfig.levelFive.id, now));
    if (profile.level >= 10) unlocked.push(this.unlock(jid, achievementConfig.levelTen.id, now));
    if (profile.level >= 20) unlocked.push(this.unlock(jid, achievementConfig.levelTwenty.id, now));
    if (profile.level >= 22) unlocked.push(this.unlock(jid, achievementConfig.skyRuler.id, now));

    return {
      unlocked: unlocked.filter((result) => result.ok).map((result) => result.achievement),
      count: unlocked.filter((result) => result.ok).length,
      event,
      value: amount,
    };
  }

  quests(jid, now = Date.now()) {
    this.ensureUser(jid);
    const key = dayKey(now);
    return questConfig.daily.map((quest) => {
      const row = this.database.get(
        `SELECT progress, completed_at, claimed_at
         FROM quest_progress
         WHERE user_jid = ? AND quest_id = ? AND period_key = ?`,
        [jid, quest.id, key],
      );
      const progress = Math.min(quest.target, Math.max(0, integer(row?.progress)));
      return {
        ...quest,
        period: key,
        progress,
        completed: progress >= quest.target,
        completedAt: row?.completed_at ?? null,
        claimed: Boolean(row?.claimed_at),
      };
    });
  }

  progressQuest(jid, event, amount = 1, now = Date.now()) {
    const value = Math.max(0, integer(amount));
    if (!value) return [];
    const key = dayKey(now);
    const changed = [];

    for (const quest of questConfig.daily.filter((item) => item.event === event)) {
      this.database.transaction(() => {
        const row = this.database.get(
          'SELECT progress, completed_at FROM quest_progress WHERE user_jid = ? AND quest_id = ? AND period_key = ?',
          [jid, quest.id, key],
        );
        const previous = Math.max(0, integer(row?.progress));
        const next = Math.min(quest.target, previous + value);
        const completedAt = next >= quest.target ? (row?.completed_at ?? now) : null;
        this.database.exec(
          `INSERT INTO quest_progress (user_jid, quest_id, period_key, progress, completed_at, claimed_at)
           VALUES (?, ?, ?, ?, ?, NULL)
           ON CONFLICT(user_jid, quest_id, period_key) DO UPDATE SET
             progress = excluded.progress,
             completed_at = excluded.completed_at`,
          [jid, quest.id, key, next, completedAt],
        );
        if (next !== previous) changed.push({ ...quest, progress: next, completed: next >= quest.target });
      });
    }
    return changed;
  }

  claimQuest(jid, questId, now = Date.now()) {
    const key = dayKey(now);
    const quest = questConfig.daily.find((item) => item.id === questId);
    if (!quest) return { ok: false, reason: 'unknown_quest' };

    let result = null;
    this.database.transaction(() => {
      const row = this.database.get(
        'SELECT progress, completed_at, claimed_at FROM quest_progress WHERE user_jid = ? AND quest_id = ? AND period_key = ?',
        [jid, questId, key],
      );
      const progress = Math.max(0, integer(row?.progress));
      if (progress < quest.target) {
        result = { ok: false, reason: 'not_completed', quest, progress };
        return;
      }
      if (row?.claimed_at) {
        result = { ok: false, reason: 'already_claimed', quest, progress };
        return;
      }

      this.database.exec(
        'UPDATE quest_progress SET claimed_at = ? WHERE user_jid = ? AND quest_id = ? AND period_key = ?',
        [now, jid, questId, key],
      );
      result = { ok: true, quest, progress, xp: quest.xp, coins: quest.coins };
    });

    if (result?.ok) {
      const xp = this.profile.addXp(jid, result.xp, `quest:${questId}`, now);
      result.xpResult = xp;
    }
    return result;
  }
}
