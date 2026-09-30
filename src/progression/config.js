export const achievementConfig = Object.freeze({
  firstSteps: { id: 'first_steps', name: 'Langkah Pertama', description: 'Menyelesaikan aksi pertama di SkyVerse.', icon: '🌟' },
  dailyRitual: { id: 'daily_ritual', name: 'Ritual Langit', description: 'Mengambil Daily untuk pertama kalinya.', icon: '🔥' },
  coinHunter: { id: 'coin_hunter', name: 'Pemburu Coin', description: 'Mengumpulkan total 1.000 Coin dari reward.', icon: '🪙' },
  socialSky: { id: 'social_sky', name: 'Utusan Langit', description: 'Melakukan transfer Coin pertama.', icon: '☁️' },
  levelFive: { id: 'level_5', name: 'Menembus Awan', description: 'Mencapai Level 5.', icon: '⭐' },
  levelTen: { id: 'level_10', name: 'Penakluk Cakrawala', description: 'Mencapai Level 10.', icon: '🌌' },
  levelTwenty: { id: 'level_20', name: 'Sultan Langit', description: 'Mencapai Level 20.', icon: '👑' },
  skyRuler: { id: 'level_22', name: 'Penguasa Langit', description: 'Mencapai Level 22.', icon: '☄️' },
});

export const questConfig = Object.freeze({
  daily: [
    { id: 'daily_claim', name: 'Berkah Harian', description: 'Ambil reward Daily 1 kali.', target: 1, event: 'daily', xp: 25, coins: 20 },
    { id: 'daily_xp', name: 'Latihan Langit', description: 'Dapatkan 30 XP dari aktivitas.', target: 30, event: 'xp', xp: 20, coins: 15 },
    { id: 'daily_transfer', name: 'Jalur Perdagangan', description: 'Kirim Coin 1 kali.', target: 1, event: 'transfer', xp: 30, coins: 25 },
  ],
});

export const progressionLimits = Object.freeze({
  maxQuestProgress: 1000000,
  questHistoryLimit: 30,
});
