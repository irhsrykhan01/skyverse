import { createCanvas } from 'canvas';
import { getMenuCategoryLabel, orderMenuCategories } from '../../core/menu-categories.js';

const WIDTH = 1080;
const PAD = 64;
const GAP = 28;
const COL_WIDTH = (WIDTH - PAD * 2 - GAP) / 2;
const COLORS = {
  bg: '#090D16',
  card: '#111827',
  cardBorder: '#253247',
  text: '#F3F6FC',
  muted: '#9AA8BC',
  accent: '#38BDF8',
  accent2: '#818CF8',
};

function measureCategory([, commands]) {
  return 92 + commands.length * 39;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export function renderAllMenu({ botName = 'SkyVerse', prefix = '.', userName = 'User', tier = 'Free User', coins = 0, groups, total = 0 }) {
  const ordered = orderMenuCategories(groups);
  const columns = [[], []];
  const heights = [0, 0];

  for (const entry of ordered) {
    const target = heights[0] <= heights[1] ? 0 : 1;
    columns[target].push(entry);
    heights[target] += measureCategory(entry) + 20;
  }

  const height = Math.max(1500, 500 + Math.max(...heights));
  if (height > 7000) throw new Error('Daftar command terlalu panjang untuk satu gambar menu.');

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, height);
  gradient.addColorStop(0, '#0B1220');
  gradient.addColorStop(1, COLORS.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, height);

  ctx.fillStyle = COLORS.accent;
  ctx.beginPath(); ctx.arc(930, 100, 150, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(930, 100, 150, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 62px Sans';
  ctx.fillText(String(botName).toUpperCase().slice(0, 20), PAD, 112);
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 26px Sans';
  ctx.fillText('SKYLABS  •  WHATSAPP ASSISTANT', PAD + 2, 158);

  ctx.fillStyle = COLORS.card;
  roundedRect(ctx, PAD, 198, WIDTH - PAD * 2, 176, 28);
  ctx.fill();
  ctx.strokeStyle = COLORS.cardBorder; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 30px Sans';
  ctx.fillText(`Halo, ${String(userName).slice(0, 24)}!`, PAD + 30, 246);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '24px Sans';
  ctx.fillText(`Tier: ${tier}     •     Coin: ${Math.max(0, Number(coins) || 0)}     •     Prefix: ${prefix}`, PAD + 30, 292);
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 26px Sans';
  ctx.fillText(`${total} COMMAND TERSEDIA`, PAD + 30, 340);

  const startY = 414;
  for (let col = 0; col < 2; col += 1) {
    let y = startY;
    const x = PAD + col * (COL_WIDTH + GAP);
    for (const [category, commands] of columns[col]) {
      const cardHeight = measureCategory([category, commands]);
      ctx.fillStyle = COLORS.card;
      roundedRect(ctx, x, y, COL_WIDTH, cardHeight, 22);
      ctx.fill();
      ctx.strokeStyle = COLORS.cardBorder; ctx.lineWidth = 2; ctx.stroke();

      ctx.fillStyle = col === 0 ? COLORS.accent : COLORS.accent2;
      ctx.font = 'bold 27px Sans';
      ctx.fillText(getMenuCategoryLabel(category).toUpperCase().slice(0, 24), x + 24, y + 43);
      ctx.fillStyle = COLORS.muted;
      ctx.font = '19px Sans';
      ctx.fillText(`${commands.length} COMMAND${commands.length === 1 ? '' : 'S'}`, x + 24, y + 72);

      ctx.fillStyle = COLORS.text;
      ctx.font = '22px Sans';
      commands.forEach((item, index) => {
        const commandText = `${prefix}${item.name}`;
        const lineY = y + 112 + index * 39;
        ctx.fillStyle = index % 2 === 0 ? COLORS.text : '#C3CDDC';
        ctx.fillText(commandText.slice(0, 30), x + 26, lineY);
      });
      y += cardHeight + 20;
    }
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = '21px Sans';
  ctx.textAlign = 'center';
  ctx.fillText('SkyVerse • Made with care by SkyLabs', WIDTH / 2, height - 44);
  return canvas.toBuffer('image/png');
}
