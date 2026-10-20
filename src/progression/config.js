export const achievementConfig = Object.freeze({
  firstSteps: { id: 'first_steps', name: 'Langkah Pertama', description: 'Menyelesaikan aksi pertama di SkyVerse.', icon: '🌟' },
  levelFive: { id: 'level_5', name: 'Menembus Awan', description: 'Mencapai Level 5.', icon: '⭐' },
  levelTen: { id: 'level_10', name: 'Penakluk Cakrawala', description: 'Mencapai Level 10.', icon: '🌌' },
  levelTwenty: { id: 'level_20', name: 'Sultan Langit', description: 'Mencapai Level 20.', icon: '👑' },
  skyRuler: { id: 'level_22', name: 'Penguasa Langit', description: 'Mencapai Level 22.', icon: '☄️' },
});

export const questConfig = Object.freeze({
  daily: [
    { id: 'daily_xp', name: 'Latihan Langit', description: 'Dapatkan 30 XP dari aktivitas.', target: 30, event: 'xp', xp: 20 },
  ],
});

export const progressionLimits = Object.freeze({
  maxQuestProgress: 1000000,
  questHistoryLimit: 30,
});
