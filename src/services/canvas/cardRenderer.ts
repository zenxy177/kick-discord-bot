import { createCanvas, loadImage, GlobalFonts, Image } from '@napi-rs/canvas';
import { CONSTANTS } from '../../config/constants.js';
import { formatNumber, formatDigitalDuration } from '../../utils/timeFormatter.js';
import { logger } from '../../utils/logger.js';

export interface LiveCardOptions {
  streamerName: string;
  avatarUrl?: string;
  streamTitle: string;
  category: string;
  viewers: number;
  startedAt: Date;
  accentColor?: string;
}

/**
 * Word wraps text to fit within maxWidth.
 */
function wrapText(
  ctx: any,
  text: string,
  maxWidth: number,
  maxLines: number = 2
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = `${currentLine} ${word}`;
    const metrics = ctx.measureText(testLine);

    if (metrics.width < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      if (lines.length >= maxLines) {
        // truncate last line with ellipsis
        currentLine = word + '...';
        break;
      }
      currentLine = word;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }

  // If text exceeded max lines, add ellipsis to last line
  if (lines.length === maxLines && words.length > 1) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '...').width > maxWidth && last.length > 3) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last.endsWith('...') ? last : last + '...';
  }

  return lines;
}

export async function renderLiveCard(options: LiveCardOptions): Promise<Buffer> {
  const width = CONSTANTS.CARD_WIDTH;
  const height = CONSTANTS.CARD_HEIGHT;
  const accent = options.accentColor || CONSTANTS.COLORS.KICK_GREEN;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Deep Dark Background with Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0a0d0f');
  bgGrad.addColorStop(0.5, '#101418');
  bgGrad.addColorStop(1, '#07090a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Kick Neon Glow in Top-Right
  const glow = ctx.createRadialGradient(width - 150, 80, 20, width - 150, 80, 400);
  glow.addColorStop(0, 'rgba(83, 252, 24, 0.18)');
  glow.addColorStop(0.5, 'rgba(83, 252, 24, 0.05)');
  glow.addColorStop(1, 'rgba(83, 252, 24, 0)');
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
  ctx.fillStyle = '#14181c';
  ctx.fill();

  // Card Border with subtle accent gradient
  const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  borderGrad.addColorStop(0, 'rgba(83, 252, 24, 0.4)');
  borderGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)');
  borderGrad.addColorStop(1, 'rgba(83, 252, 24, 0.2)');
  ctx.lineWidth = 2;
  ctx.strokeStyle = borderGrad;
  ctx.stroke();
  ctx.restore();

  // 4. Header Bar: Kick Logo Pill + Live Pill
  // Kick Badge
  const headerY = cardY + 36;
  const kickBadgeX = cardX + 36;
  
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(kickBadgeX, headerY, 80, 32, 8);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.font = 'bold 18px "Arial", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KICK', kickBadgeX + 40, headerY + 16);
  ctx.restore();

  // LIVE Status Badge
  const liveBadgeX = kickBadgeX + 96;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(liveBadgeX, headerY, 140, 32, 8);
  ctx.fillStyle = 'rgba(229, 57, 53, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#e53935';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Red blinking dot
  ctx.beginPath();
  ctx.arc(liveBadgeX + 18, headerY + 16, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#e53935';
  ctx.fill();

  ctx.font = 'bold 15px "Arial", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('CANLI YAYIN', liveBadgeX + 32, headerY + 16);
  ctx.restore();

  // Category Tag (Right side of header)
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#cfd8dc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(catText, catX + 12, headerY + 16);
    ctx.restore();
  }

  // 5. Streamer Avatar (Left Circle with glowing border)
  const avatarSize = 130;
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
  // Outer Neon Glow Ring
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 12;
  ctx.stroke();

  // Clip Avatar
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  if (avatarImage) {
    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    // Stylized Fallback Avatar
    const avGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    avGrad.addColorStop(0, '#263238');
    avGrad.addColorStop(1, '#101418');
    ctx.fillStyle = avGrad;
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.font = 'bold 50px "Arial", sans-serif';
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      (options.streamerName[0] || 'K').toUpperCase(),
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2
    );
  }
  ctx.restore();

  // 6. Streamer Name & Verified Kick Checkmark
  const contentX = avatarX + avatarSize + 30;
  const contentWidth = cardW - (contentX - cardX) - 36;

  ctx.save();
  ctx.font = 'bold 34px "Arial", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(options.streamerName, contentX, avatarY + 5);

  const nameWidth = ctx.measureText(options.streamerName).width;
  // Green verified badge
  ctx.beginPath();
  ctx.arc(contentX + nameWidth + 18, avatarY + 22, 10, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.font = 'bold 12px "Arial", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓', contentX + nameWidth + 18, avatarY + 22);
  ctx.restore();

  // 7. Stream Title (Wrapped lines)
  ctx.save();
  ctx.font = '600 24px "Arial", sans-serif';
  ctx.fillStyle = '#e0e0e0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const titleLines = wrapText(ctx, options.streamTitle, contentWidth, 2);
  const titleStartY = avatarY + 54;
  titleLines.forEach((line, index) => {
    ctx.fillText(line, contentX, titleStartY + index * 32);
  });
  ctx.restore();

  // 8. Stats Ribbon Cards (Viewers, Duration, Time)
  const statsY = cardY + cardH - 100;
  const statBoxH = 68;
  const gap = 20;
  const statBoxW = (cardW - 72 - gap * 2) / 3;

  // Stat 1: Anlık İzleyici
  renderStatBox(
    ctx,
    cardX + 36,
    statsY,
    statBoxW,
    statBoxH,
    '👁️ ANLIK İZLEYİCİ',
    `${formatNumber(options.viewers)} kişi`,
    accent
  );

  // Stat 2: Yayında Geçen Süre
  const durationStr = formatDigitalDuration(options.startedAt);
  renderStatBox(
    ctx,
    cardX + 36 + statBoxW + gap,
    statsY,
    statBoxW,
    statBoxH,
    '⏱️ YAYINDA GEÇEN SÜRE',
    durationStr,
    '#ffffff'
  );

  // Stat 3: Başlangıç Saati
  const startTimeStr = options.startedAt.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  renderStatBox(
    ctx,
    cardX + 36 + (statBoxW + gap) * 2,
    statsY,
    statBoxW,
    statBoxH,
    '🚀 BAŞLAMA SAATİ',
    startTimeStr,
    '#90caf9'
  );

  return canvas.toBuffer('image/png');
}

function renderStatBox(
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
  ctx.fillStyle = '#1a1f26';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.font = 'bold 12px "Arial", sans-serif';
  ctx.fillStyle = '#8b98a5';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 16, y + 14);

  // Value
  ctx.font = 'bold 22px "Arial", sans-serif';
  ctx.fillStyle = valueColor;
  ctx.fillText(value, x + 16, y + 34);
  ctx.restore();
}
