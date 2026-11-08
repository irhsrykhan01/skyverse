export const MENU_CATEGORY_DEFINITIONS = Object.freeze([
  { key: 'downloader', label: 'Downloader' },
  { key: 'general', label: 'General Menu' },
  { key: 'maker', label: 'Maker' },
  { key: 'sticker', label: 'Sticker Maker' },
  { key: 'sticker-media', label: 'Media Tools' },
  { key: 'media', label: 'Media' },
  { key: 'tools', label: 'Tools' },
  { key: 'games', label: 'Games' },
  { key: 'group', label: 'Group' },
  { key: 'channel', label: 'Channel' },
  { key: 'user', label: 'User' },
  { key: 'system', label: 'System' },
]);

const LABEL_TO_KEY = new Map(
  MENU_CATEGORY_DEFINITIONS.map(({ key, label }) => [label.toLowerCase(), key]),
);

export function getMenuCategoryLabel(category) {
  const normalized = String(category ?? '').trim().toLowerCase();
  return MENU_CATEGORY_DEFINITIONS.find((item) => item.key === normalized)?.label
    ?? normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function resolveMenuCategory(category, groups = null) {
  const normalized = String(category ?? '').trim().toLowerCase();
  const known = MENU_CATEGORY_DEFINITIONS.some((item) => item.key === normalized)
    ? normalized
    : LABEL_TO_KEY.get(normalized);
  if (known) return known;
  return groups instanceof Map && groups.has(normalized) ? normalized : null;
}

export function orderMenuCategories(groups) {
  const rank = new Map(MENU_CATEGORY_DEFINITIONS.map((item, index) => [item.key, index]));
  return [...groups.entries()]
    .sort((a, b) => {
      const ar = rank.has(a[0]) ? rank.get(a[0]) : Number.MAX_SAFE_INTEGER;
      const br = rank.has(b[0]) ? rank.get(b[0]) : Number.MAX_SAFE_INTEGER;
      return ar - br || a[0].localeCompare(b[0]);
    });
}
