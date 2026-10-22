import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import { CONSTANTS } from '../../config/constants.js';
import { formatNumber, formatDuration } from '../../utils/timeFormatter.js';

export interface SummaryCardOptions {
  streamerName: string;
  avatarUrl?: string;
  streamTitle: string;
  category: string;
  startedAt: Date;
  endedAt: Date;
  peakViewers: number;
  averageViewers?: number;
  accentColor?: string;
}

export async function renderSummaryCard(options: SummaryCardOptions): Promise<Buffer> {
  const width = CONSTANTS.CARD_WIDTH;
  const height = CONSTANTS.CARD_HEIGHT;
  const accent = options.accentColor || CONSTANTS.COLORS.KICK_GREEN;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0a0c0e');
  bgGrad.addColorStop(1, '#0e1013');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Muted Blue/Purple ambient accent in background
  const glow = ctx.createRadialGradient(width / 2, 0, 50, width / 2, 0, 500);
  glow.addColorStop(0, 'rgba(96, 125, 139, 0.15)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 3. Main Glass Card Container
  const pad = 24;
  const cardX = pad;
  const cardY = pad;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  const radius = 24;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = '#14171a';
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.stroke();
  ctx.restore();

  // 4. Header Bar: Kick Logo + Stream Ended Pill
  const headerY = cardY + 36;
  const kickBadgeX = cardX + 36;

  // Kick badge
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(kickBadgeX, headerY, 80, 32, 8);
  ctx.fillStyle = '#263238';
  ctx.fill();
  ctx.font = 'bold 18px "Arial", sans-serif';
  ctx.fillStyle = '#b0bec5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KICK', kickBadgeX + 40, headerY + 16);
  ctx.restore();

  // Ended Badge
  const endedBadgeX = kickBadgeX + 96;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(endedBadgeX, headerY, 180, 32, 8);
  ctx.fillStyle = 'rgba(120, 144, 156, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#78909c';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 15px "Arial", sans-serif';
  ctx.fillStyle = '#eceff1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⬛ YAYIN SONA ERDİ', endedBadgeX + 90, headerY + 16);
  ctx.restore();

  // Category Tag
  if (options.category) {
    ctx.save();
    const catText = `🎮 ${options.category}`;
    ctx.font = 'bold 15px "Arial", sans-serif';
    const catMetrics = ctx.measureText(catText);
    const catW = catMetrics.width + 24;
    const catX = cardX + cardW - 36 - catW;

    ctx.beginPath();
    ctx.roundRect(catX, headerY, catW, 32, 8);
    ctx.fillStyle = '#1e242b';
    ctx.fill();
    ctx.fillStyle = '#b0bec5';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(catText, catX + 12, headerY + 16);
    ctx.restore();
  }

  // 5. Streamer Avatar (Grayscale / Muted Border)
  const avatarSize = 120;
  const avatarX = cardX + 36;
  const avatarY = cardY + 95;

  let avatarImage: Image | null = null;
  if (options.avatarUrl) {
    try {
      avatarImage = await loadImage(options.avatarUrl);
    } catch {
      avatarImage = null;
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = '#546e7a';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  if (avatarImage) {
    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#263238';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.font = 'bold 45px "Arial", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      (options.streamerName[0] || 'K').toUpperCase(),
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2
    );
  }
  ctx.restore();

  // 6. Title and Summary Sentence
  const contentX = avatarX + avatarSize + 28;
  ctx.save();
  ctx.font = 'bold 30px "Arial", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(options.streamerName, contentX, avatarY + 5);

  const durationStr = formatDuration(options.startedAt, options.endedAt);
  ctx.font = '500 20px "Arial", sans-serif';
  ctx.fillStyle = '#b0bec5';
  ctx.fillText(`Bu yayın ${durationStr} sürdü.`, contentX, avatarY + 48);

  ctx.font = 'italic 16px "Arial", sans-serif';
  ctx.fillStyle = '#78909c';
  ctx.fillText(`"${options.streamTitle.slice(0, 50)}${options.streamTitle.length > 50 ? '...' : ''}"`, contentX, avatarY + 78);
  ctx.restore();

  // 7. Stats Ribbon Cards (Peak Viewers, Total Duration, Avg Viewers)
  const statsY = cardY + cardH - 105;
  const statBoxH = 75;
  const gap = 20;
  const statBoxW = (cardW - 72 - gap * 2) / 3;

  // Stat 1: Zirve İzleyici
  renderSummaryStatBox(
    ctx,
    cardX + 36,
    statsY,
    statBoxW,
    statBoxH,
    '🏆 ZİRVE İZLEYİCİ',
    `${formatNumber(options.peakViewers)} kişi`,
    accent
  );

  // Stat 2: Toplam Süre
  renderSummaryStatBox(
    ctx,
    cardX + 36 + statBoxW + gap,
    statsY,
    statBoxW,
    statBoxH,
    '⏳ TOPLAM SÜRE',
    durationStr,
    '#ffffff'
  );

  // Stat 3: Ortalama İzleyici
  const avgViewers = options.averageViewers || Math.round(options.peakViewers * 0.72);
  renderSummaryStatBox(
    ctx,
    cardX + 36 + (statBoxW + gap) * 2,
    statsY,
    statBoxW,
    statBoxH,
    '📊 ORTALAMA İZLEYİCİ',
    `${formatNumber(avgViewers)} kişi`,
    '#90caf9'
  );

  return canvas.toBuffer('image/png');
}

function renderSummaryStatBox(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  valueColor: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fillStyle = '#181c21';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 12px "Arial", sans-serif';
  ctx.fillStyle = '#78909c';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 16, y + 14);

  ctx.font = 'bold 22px "Arial", sans-serif';
  ctx.fillStyle = valueColor;
  ctx.fillText(value, x + 16, y + 36);
  ctx.restore();
}
