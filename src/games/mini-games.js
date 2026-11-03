const sessions = new Map();
const DEFAULT_TTL = 3 * 60 * 1000;
const REWARD_RANGES = Object.freeze({
  trivia: [10, 20],
  benarsalah: [5, 12],
  quizcepat: [3, 6],
  susunkata: [12, 24],
  tebakkata: [12, 24],
  tebakemoji: [10, 20],
  tebakangka: [8, 18],
  rps: [3, 8],
});

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeAnswer(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]+/g, '');
}

function getSession(chatId) {
  return sessions.get(String(chatId));
}

function playerState(session, userId, defaults = {}) {
  const key = String(userId);
  if (!session.players.has(key)) session.players.set(key, { ...defaults, finished: false });
  return session.players.get(key);
}

function completedMessage() {
  return 'Kamu sudah menyelesaikan game ini. Peserta lain masih bisa ikut sampai sesi berakhir.';
}

function choiceResult(input, question) {
  const value = normalizeAnswer(input);
  if (/^[a-d]$/.test(value)) {
    return { valid: true, correct: value.toUpperCase() === question.correctLetter };
  }
  const index = (question.choices || []).findIndex((choice) => normalizeAnswer(choice) === value);
  if (index < 0) return { valid: false, correct: false };
  return { valid: true, correct: 'ABCD'[index] === question.correctLetter };
}

function formatQuickQuizPrompt(session, player) {
  const state = session.state;
  const question = state.questions[player.index];
  return [
    '⚡ *QUIZ CEPAT*',
    'Soal ' + (player.index + 1) + '/' + state.questions.length + ' • Skor: ' + player.score,
    'Kategori: ' + (question.category || 'General Knowledge'),
    '',
    question.question,
    '',
    question.choices.map((choice, index) => String.fromCharCode(65 + index) + '. ' + choice).join('\n'),
    '',
    'Balas pesan ini dengan A, B, C, atau D.',
    question.source === 'Open Trivia DB'
      ? 'Sumber soal: Open Trivia DB (opentdb.com).'
      : 'Sumber soal: bank offline SkyVerse.',
  ].join('\n');
}

export function startMiniGame({ userId, chatId, gameMessageId, type, answer = null, state = {}, expiresIn = DEFAULT_TTL }) {
  if (!userId || !chatId || !gameMessageId || !type) return null;
  const ttl = Math.max(30_000, Number(expiresIn) || DEFAULT_TTL);
  const session = {
    ownerId: String(userId),
    chatId: String(chatId),
    gameMessageId: String(gameMessageId),
    playerMessageIds: new Map(),
    type: String(type),
    answer,
    state,
    players: new Map(),
    expiresIn: ttl,
    startedAt: Date.now(),
    expiresAt: Date.now() + ttl,
  };
  sessions.set(String(chatId), session);
  return session;
}

export function getMiniGame(_userId, chatId) {
  const session = getSession(chatId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(String(chatId));
    return null;
  }
  return session;
}

export function isMiniGameReply(userId, { chatId, stanzaId } = {}) {
  const session = getMiniGame(userId, chatId);
  if (!session || !stanzaId) return false;
  const id = String(stanzaId);
  if (session.gameMessageId === id) return true;
  return session.playerMessageIds.get(String(userId)) === id;
}

export function updateMiniGameMessage(userId, chatId, gameMessageId) {
  const session = getMiniGame(userId, chatId);
  if (!session || !gameMessageId) return false;
  session.playerMessageIds.set(String(userId), String(gameMessageId));
  session.expiresAt = Date.now() + session.expiresIn;
  return true;
}

export function stopMiniGame(_userId, chatId) {
  sessions.delete(String(chatId));
}

function invalidReply(session) {
  if (session.type === 'trivia' || session.type === 'quizcepat') {
    return 'Balas dengan A, B, C, atau D. Jawab dengan me-reply pesan game.';
  }
  if (session.type === 'benarsalah') return 'Balas dengan *benar* atau *salah* dengan me-reply pesan game.';
  if (session.type === 'tebakangka') return 'Masukkan angka bulat sesuai rentang game, lalu reply pesan ini.';
  if (session.type === 'rps') return 'Balas dengan *batu*, *gunting*, atau *kertas* dengan me-reply pesan game.';
  return 'Jawaban belum terbaca. Coba lagi dengan me-reply pesan game.';
}

function completedResult(session, player, text, reward = 0) {
  player.finished = true;
  session.expiresAt = Date.now() + session.expiresIn;
  return {
    matched: true,
    complete: true,
    keep: false,
    game: session.type,
    reward,
    text,
  };
}

export function answerMiniGame(userId, chatId, stanzaId, input) {
  const session = getMiniGame(userId, chatId);
  if (!session || !stanzaId) return { matched: false };
  const replyId = String(stanzaId);
  if (session.gameMessageId !== replyId && session.playerMessageIds.get(String(userId)) !== replyId) {
    return { matched: false };
  }

  const value = normalizeAnswer(input);
  const state = session.state || {};
  const player = playerState(session, userId, session.type === 'quizcepat'
    ? { index: 0, score: 0, earned: 0 }
    : { attempts: 0 });

  if (player.finished) {
    return { matched: true, keep: false, text: completedMessage() };
  }

  if (session.type === 'trivia') {
    const result = choiceResult(value, state);
    if (!result.valid) return { matched: true, keep: true, text: invalidReply(session) };
    if (result.correct) {
      const range = REWARD_RANGES.trivia;
      return completedResult(session, player,
        '✅ Benar! Jawabannya: ' + state.correctAnswer + '.', randomInt(range[0], range[1]));
    }
    return completedResult(session, player,
      '❌ Belum tepat. Jawaban yang benar: ' + state.correctAnswer + '.');
  }

  if (session.type === 'benarsalah') {
    let valueBoolean = null;
    if (['benar', 'betul', 'true', 'ya', 'y', 'b'].includes(value)) valueBoolean = true;
    if (['salah', 'false', 'tidak', 'nggak', 'enggak', 'ga', 'f', 's'].includes(value)) valueBoolean = false;
    if (valueBoolean === null) return { matched: true, keep: true, text: invalidReply(session) };
    const correct = valueBoolean === Boolean(session.answer);
    const rewardRange = REWARD_RANGES.benarsalah;
    return completedResult(session, player,
      (correct ? '✅ Betul!' : '❌ Belum tepat.') + ' Jawaban yang benar: ' + (session.answer ? 'BENAR' : 'SALAH') + '.',
      correct ? randomInt(rewardRange[0], rewardRange[1]) : 0);
  }

  if (session.type === 'quizcepat') {
    const question = state.questions?.[player.index];
    if (!question) return completedResult(session, player, 'Quiz sudah selesai. Skor kamu: ' + player.score + '/' + state.questions.length + '.', player.earned);
    const result = choiceResult(value, question);
    if (!result.valid) return { matched: true, keep: true, text: invalidReply(session) };

    if (result.correct) {
      player.score += 1;
      const range = REWARD_RANGES.quizcepat;
      player.earned += randomInt(range[0], range[1]);
    }
    const feedback = result.correct
      ? '✅ Benar!'
      : '❌ Salah. Jawaban: ' + question.correctAnswer + '.';
    player.index += 1;

    if (player.index < state.questions.length) {
      return {
        matched: true,
        keep: true,
        game: session.type,
        text: feedback + '\n\n' + formatQuickQuizPrompt(session, player),
      };
    }

    return completedResult(session, player,
      feedback + '\n\n🏁 *Quiz selesai!* Skor kamu: ' + player.score + '/' + state.questions.length + '.',
      player.earned);
  }

  if (session.type === 'tebakangka') {
    if (!/^\d{1,3}$/.test(value)) return { matched: true, keep: true, text: invalidReply(session) };
    const guess = Number(value);
    const minimum = Number(state.minimum ?? 1);
    const maximum = Number(state.maximum ?? 30);
    if (guess < minimum || guess > maximum) {
      return {
        matched: true,
        keep: true,
        text: 'Angka harus antara ' + minimum + ' dan ' + maximum + '. Coba lagi dengan me-reply pesan ini.',
      };
    }

    player.attempts = Number(player.attempts || 0) + 1;
    if (guess === Number(session.answer)) {
      const range = REWARD_RANGES.tebakangka;
      return completedResult(session, player,
        '🎉 Tepat! Angkanya ' + session.answer + '. Kamu berhasil dalam ' + player.attempts + ' percobaan.',
        randomInt(range[0], range[1]));
    }

    const maxAttempts = Number(state.maxAttempts ?? 6);
    if (player.attempts >= maxAttempts) {
      return completedResult(session, player, 'Game selesai! Angka yang benar adalah ' + session.answer + '.');
    }

    return {
      matched: true,
      keep: true,
      text: (guess < Number(session.answer) ? '📈 Terlalu kecil!' : '📉 Terlalu besar!')
        + ' Percobaan ' + player.attempts + '/' + maxAttempts + '. Coba angka lain dengan me-reply pesan ini.',
    };
  }

  if (session.type === 'susunkata' || session.type === 'tebakkata') {
    const accepted = [session.answer, ...(Array.isArray(state.accepted) ? state.accepted : [])].map(normalizeAnswer);
    if (accepted.includes(value)) {
      const range = REWARD_RANGES[session.type];
      return completedResult(session, player,
        '🎉 Benar! Kata yang dicari: ' + session.answer + '.'
          + (state.definition ? '\nArti: ' + state.definition : '')
          + (state.attribution ? '\n\n' + state.attribution : ''),
        randomInt(range[0], range[1]));
    }

    player.attempts = Number(player.attempts || 0) + 1;
    const maxAttempts = Number(state.maxAttempts ?? 3);
    if (player.attempts >= maxAttempts) {
      return completedResult(session, player,
        'Kesempatan habis! Jawabannya: ' + session.answer + '.'
          + (state.definition ? '\nArti: ' + state.definition : '')
          + (state.attribution ? '\n\n' + state.attribution : ''));
    }

    return {
      matched: true,
      keep: true,
      text: 'Belum tepat 😅 Sisa kesempatan: ' + (maxAttempts - player.attempts)
        + '. Coba lagi dengan me-reply pesan ini.',
    };
  }

  if (session.type === 'tebakemoji') {
    const accepted = [session.answer, ...(Array.isArray(state.accepted) ? state.accepted : [])].map(normalizeAnswer);
    if (accepted.includes(value)) {
      const range = REWARD_RANGES.tebakemoji;
      return completedResult(session, player, '🎉 Betul! Jawabannya: ' + session.answer + '.', randomInt(range[0], range[1]));
    }

    player.attempts = Number(player.attempts || 0) + 1;
    const maxAttempts = Number(state.maxAttempts ?? 3);
    if (player.attempts >= maxAttempts) {
      return completedResult(session, player, 'Kesempatan habis! Jawabannya: ' + session.answer + '.');
    }

    return {
      matched: true,
      keep: true,
      text: 'Belum tepat 😅 Sisa kesempatan: ' + (maxAttempts - player.attempts)
        + '. Coba lagi dengan me-reply pesan ini.',
    };
  }

  if (session.type === 'rps') {
    const aliases = {
      batu: 'batu', rock: 'batu',
      gunting: 'gunting', scissors: 'gunting',
      kertas: 'kertas', paper: 'kertas',
    };
    const playerMove = aliases[value];
    if (!playerMove) return { matched: true, keep: true, text: invalidReply(session) };

    const moves = ['batu', 'gunting', 'kertas'];
    const botMove = moves[Math.floor(Math.random() * moves.length)];
    const won = ((playerMove === 'batu' && botMove === 'gunting')
      || (playerMove === 'gunting' && botMove === 'kertas')
      || (playerMove === 'kertas' && botMove === 'batu'));
    const outcome = playerMove === botMove
      ? 'Seri! 🤝'
      : won ? 'Kamu menang! 🎉' : 'SkyVerse menang! 😎';
    const range = REWARD_RANGES.rps;
    return completedResult(session, player,
      '✊ *BATU GUNTING KERTAS*\nKamu: ' + playerMove + '\nSkyVerse: ' + botMove + '\n\n' + outcome,
      won ? randomInt(range[0], range[1]) : 0);
  }

  return completedResult(session, player, 'Game ditutup karena tipe game tidak dikenal.');
}
