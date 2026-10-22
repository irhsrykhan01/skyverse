import { createCanvas } from 'canvas';

function clean(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 120) : fallback;
}

function wrap(ctx, text, maxWidth) {
  const words = clean(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export function renderMockUi({ title, subtitle = 'SkyVerse Mock Maker', fields = [] }) {
  const width = 1080;
  const height = 1350;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#101319';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1b2230';
  ctx.beginPath();
  ctx.roundRect(70, 110, width - 140, height - 220, 42);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(clean(title, 'MOCKUP'), 125, 215);

  ctx.fillStyle = '#aeb8ca';
  ctx.font = '30px sans-serif';
  ctx.fillText(clean(subtitle), 125, 270);

  let y = 375;
  for (const field of fields.slice(0, 7)) {
    ctx.fillStyle = '#7f8ca3';
    ctx.font = 'bold 25px sans-serif';
    ctx.fillText(clean(field.label).toUpperCase(), 125, y);

    ctx.fillStyle = '#ffffff';
    ctx.font = '34px sans-serif';
    const lines = wrap(ctx, field.value, width - 250);
    for (const line of lines) {
      y += 46;
      ctx.fillText(line, 125, y);
    }
    y += 65;
  }

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-0.38);
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEMO • PARODY', 0, 0);
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#e4e8ef';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEMO • bukan screenshot asli • SkyVerse', width / 2, height - 145);

  return canvas.toBuffer('image/png');
}
