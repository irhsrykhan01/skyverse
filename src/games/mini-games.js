const sessions = new Map();
const DEFAULT_TTL = 3 * 60 * 1000;

function keyFor(userId, chatId) {
  return String(chatId) + '\u0000' + String(userId);
}

function normalizeAnswer(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]+/g, '');
}

function removeSession(userId, chatId) {
  sessions.delete(keyFor(userId, chatId));
}

function answerCredit(session) {
  return session.state?.attribution ? '\n\n' + session.state.attribution : '';
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

function formatQuickQuizPrompt(session) {
  const state = session.state;
  const question = state.questions[state.index];
  return [
    '⚡ *QUIZ CEPAT*',
    'Soal ' + (state.index + 1) + '/' + state.questions.length + ' • Skor: ' + state.score,
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
  const session = {
    userId: String(userId),
    chatId: String(chatId),
    gameMessageId: String(gameMessageId),
    type: String(type),
    answer,
    state,
    expiresIn: Math.max(30_000, Number(expiresIn) || DEFAULT_TTL),
    startedAt: Date.now(),
    expiresAt: Date.now() + Math.max(30_000, Number(expiresIn) || DEFAULT_TTL),
  };
  sessions.set(keyFor(userId, chatId), session);
  return session;
}

export function getMiniGame(userId, chatId) {
  const key = keyFor(userId, chatId);
  const session = sessions.get(key);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  return session;
}

export function isMiniGameReply(userId, { chatId, stanzaId } = {}) {
  const session = getMiniGame(userId, chatId);
  return Boolean(session && stanzaId && session.gameMessageId === String(stanzaId));
}

export function updateMiniGameMessage(userId, chatId, gameMessageId) {
  const session = getMiniGame(userId, chatId);
  if (!session || !gameMessageId) return false;
  session.gameMessageId = String(gameMessageId);
  session.expiresAt = Date.now() + session.expiresIn;
  return true;
}

export function stopMiniGame(userId, chatId) {
  removeSession(userId, chatId);
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

export function answerMiniGame(userId, chatId, stanzaId, input) {
  const session = getMiniGame(userId, chatId);
  if (!session || !stanzaId || session.gameMessageId !== String(stanzaId)) return { matched: false };

  const value = normalizeAnswer(input);
  const state = session.state || {};

  if (session.type === 'trivia') {
    const result = choiceResult(value, state);
    if (!result.valid) return { matched: true, keep: true, text: invalidReply(session) };
    removeSession(userId, chatId);
    return {
      matched: true,
      complete: true,
      text: result.correct
        ? '✅ Benar! Jawabannya: ' + state.correctAnswer + '.'
        : '❌ Belum tepat. Jawaban yang benar: ' + state.correctAnswer + '.',
    };
  }

  if (session.type === 'benarsalah') {
    let valueBoolean = null;
    if (['benar', 'betul', 'true', 'ya', 'y', 'b'].includes(value)) valueBoolean = true;
    if (['salah', 'false', 'tidak', 'nggak', 'enggak', 'ga', 'f', 's'].includes(value)) valueBoolean = false;
    if (valueBoolean === null) return { matched: true, keep: true, text: invalidReply(session) };
    removeSession(userId, chatId);
    const correct = valueBoolean === Boolean(session.answer);
    return {
      matched: true,
      complete: true,
      text: (correct ? '✅ Betul!' : '❌ Belum tepat.') + ' Jawaban yang benar: ' + (session.answer ? 'BENAR' : 'SALAH') + '.',
    };
  }

  if (session.type === 'quizcepat') {
    const question = state.questions?.[state.index];
    if (!question) {
      removeSession(userId, chatId);
      return { matched: true, complete: true, text: 'Quiz sudah selesai.' };
    }

    const result = choiceResult(value, question);
    if (!result.valid) return { matched: true, keep: true, text: invalidReply(session) };

    if (result.correct) state.score += 1;
    const feedback = result.correct
      ? '✅ Benar!'
      : '❌ Salah. Jawaban: ' + question.correctAnswer + '.';
    state.index += 1;

    if (state.index < state.questions.length) {
      return { matched: true, keep: true, text: feedback + '\n\n' + formatQuickQuizPrompt(session) };
    }

    removeSession(userId, chatId);
    return {
      matched: true,
      complete: true,
      text: feedback + '\n\n🏁 *Quiz selesai!* Skor kamu: ' + state.score + '/' + state.questions.length + '.',
    };
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

    state.attempts = Number(state.attempts || 0) + 1;
    if (guess === Number(session.answer)) {
      removeSession(userId, chatId);
      return {
        matched: true,
        complete: true,
        text: '🎉 Tepat! Angkanya ' + session.answer + '. Kamu berhasil dalam ' + state.attempts + ' percobaan.',
      };
    }

    const maxAttempts = Number(state.maxAttempts ?? 6);
    if (state.attempts >= maxAttempts) {
      removeSession(userId, chatId);
      return {
        matched: true,
        complete: true,
        text: 'Game selesai! Angka yang benar adalah ' + session.answer + '.',
      };
    }

    return {
      matched: true,
      keep: true,
      text: (guess < Number(session.answer) ? '📈 Terlalu kecil!' : '📉 Terlalu besar!')
        + ' Percobaan ' + state.attempts + '/' + maxAttempts + '. Coba angka lain dengan me-reply pesan ini.',
    };
  }

  if (session.type === 'susunkata' || session.type === 'tebakkata') {
    const accepted = [session.answer, ...(Array.isArray(state.accepted) ? state.accepted : [])].map(normalizeAnswer);
    if (accepted.includes(value)) {
      removeSession(userId, chatId);
      return {
        matched: true,
        complete: true,
        text: '🎉 Benar! Kata yang dicari: ' + session.answer + '.'
          + (state.definition ? '\nArti: ' + state.definition : '')
          + answerCredit(session),
      };
    }

    state.attempts = Number(state.attempts || 0) + 1;
    const maxAttempts = Number(state.maxAttempts ?? 3);
    if (state.attempts >= maxAttempts) {
      removeSession(userId, chatId);
      return {
        matched: true,
        complete: true,
        text: 'Kesempatan habis! Jawabannya: ' + session.answer + '.'
          + (state.definition ? '\nArti: ' + state.definition : '')
          + answerCredit(session),
      };
    }

    return {
      matched: true,
      keep: true,
      text: 'Belum tepat 😅 Sisa kesempatan: ' + (maxAttempts - state.attempts)
        + '. Coba lagi dengan me-reply pesan ini.' + answerCredit(session),
    };
  }

  if (session.type === 'tebakemoji') {
    const accepted = [session.answer, ...(Array.isArray(state.accepted) ? state.accepted : [])].map(normalizeAnswer);
    if (accepted.includes(value)) {
      removeSession(userId, chatId);
      return { matched: true, complete: true, text: '🎉 Betul! Jawabannya: ' + session.answer + '.' };
    }

    state.attempts = Number(state.attempts || 0) + 1;
    const maxAttempts = Number(state.maxAttempts ?? 3);
    if (state.attempts >= maxAttempts) {
      removeSession(userId, chatId);
      return { matched: true, complete: true, text: 'Kesempatan habis! Jawabannya: ' + session.answer + '.' };
    }

    return {
      matched: true,
      keep: true,
      text: 'Belum tepat 😅 Sisa kesempatan: ' + (maxAttempts - state.attempts)
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
    const outcome = playerMove === botMove
      ? 'Seri! 🤝'
      : ((playerMove === 'batu' && botMove === 'gunting')
        || (playerMove === 'gunting' && botMove === 'kertas')
        || (playerMove === 'kertas' && botMove === 'batu'))
        ? 'Kamu menang! 🎉'
        : 'SkyVerse menang! 😎';
    removeSession(userId, chatId);
    return {
      matched: true,
      complete: true,
      text: '✊ *BATU GUNTING KERTAS*\nKamu: ' + playerMove + '\nSkyVerse: ' + botMove + '\n\n' + outcome,
    };
  }

  removeSession(userId, chatId);
  return { matched: true, complete: true, text: 'Game ditutup karena tipe game tidak dikenal.' };
}
