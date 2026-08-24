const TOKEN = /\s*(\d+(?:\.\d+)?|[()+\-*/%])\s*/gy;

function tokenize(input) {
  const source = String(input).trim();
  if (!source || source.length > 200) throw new Error('Ekspresi kalkulator tidak valid.');

  const tokens = [];
  let index = 0;
  while (index < source.length) {
    TOKEN.lastIndex = index;
    const match = TOKEN.exec(source);
    if (!match || match.index !== index) {
      throw new Error('Ekspresi hanya boleh berisi angka dan operator + - * / % serta tanda kurung.');
    }
    tokens.push(match[1]);
    index = TOKEN.lastIndex;
  }
  return tokens;
}

export function calculate(input) {
  const tokens = tokenize(input);
  let position = 0;

  function peek() {
    return tokens[position];
  }

  function consume(expected) {
    const token = tokens[position];
    if (expected && token !== expected) throw new Error('Ekspresi tidak lengkap.');
    position += 1;
    return token;
  }

  function parseExpression() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const right = parseFactor();
      if (op === '*') value *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Tidak bisa membagi dengan nol.');
        value /= right;
      } else {
        if (right === 0) throw new Error('Modulo dengan nol tidak valid.');
        value %= right;
      }
    }
    return value;
  }

  function parseFactor() {
    const token = peek();
    if (token === '+') {
      consume('+');
      return parseFactor();
    }
    if (token === '-') {
      consume('-');
      return -parseFactor();
    }
    if (token === '(') {
      consume('(');
      const value = parseExpression();
      consume(')');
      return value;
    }
    if (!/^\d+(?:\.\d+)?$/.test(token ?? '')) throw new Error('Angka tidak valid.');
    consume();
    return Number(token);
  }

  const result = parseExpression();
  if (position !== tokens.length || !Number.isFinite(result)) {
    throw new Error('Ekspresi kalkulator tidak valid.');
  }
  return result;
}
