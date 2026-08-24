export function levenshteinDistance(a, b) {
  const left = String(a);
  const right = String(b);
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const insert = current[j - 1] + 1;
      const remove = previous[j] + 1;
      const replace = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(insert, remove, replace);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

export function suggestNames(input, names, limit = 3) {
  const query = String(input).toLowerCase();
  return names
    .map((name) => ({ name, distance: levenshteinDistance(query, name.toLowerCase()) }))
    .sort((a, b) => a.distance - b.distance)
    .filter(({ distance }) => distance <= Math.max(2, Math.ceil(query.length / 2)))
    .slice(0, limit)
    .map(({ name }) => name);
}
