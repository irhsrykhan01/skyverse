const LEVEL_STEP = 100;

export const profileConfig = Object.freeze({
  xp: Object.freeze({
    basePerLevel: LEVEL_STEP,
    messageReward: 5,
    commandReward: 8,
    activityCooldownMs: 30_000,
    maxGainPerAction: 50,
  }),
  profile: Object.freeze({
    maxBioLength: 120,
  }),
});

export const levelTitles = Object.freeze([
  Object.freeze({ min: 1, max: 3, name: 'Bintang Kecil' }),
  Object.freeze({ min: 4, max: 5, name: 'Pengawal Langit' }),
  Object.freeze({ min: 6, max: 10, name: 'Penakluk Cakrawala' }),
  Object.freeze({ min: 11, max: 20, name: 'Sultan Langit' }),
  Object.freeze({ min: 22, max: Number.MAX_SAFE_INTEGER, name: 'Penguasa Langit' }),
]);

export function xpForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return LEVEL_STEP * safeLevel * (safeLevel - 1) / 2;
}

export function levelFromXp(xp) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  while (level < 22 && xpForLevel(level + 1) <= safeXp) level += 1;
  if (level >= 22) return level;
  return level;
}

export function titleForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const title = levelTitles.find((item) => safeLevel >= item.min && safeLevel <= item.max);
  return title?.name ?? 'Penjelajah Langit';
}

export function levelProgress(xp) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const level = levelFromXp(safeXp);
  const currentFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  const needed = Math.max(0, nextFloor - currentFloor);
  const progress = Math.max(0, Math.min(needed, safeXp - currentFloor));

  return Object.freeze({
    level,
    currentXp: safeXp,
    currentFloor,
    nextFloor,
    progress,
    needed,
    percent: needed ? Math.floor((progress / needed) * 100) : 100,
    title: titleForLevel(level),
  });
}
