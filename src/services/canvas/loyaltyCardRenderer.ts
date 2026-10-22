import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import { CONSTANTS } from '../../config/constants.js';
import { formatNumber } from '../../utils/timeFormatter.js';

export interface LoyaltyCardOptions {
  discordUsername: string;
  kickUsername: string;
  avatarUrl?: string;
  totalWatchMinutes: number;
  loyaltyPoints: number;
  messagesSent: number;
  isSubscribed: boolean;
  isVip: boolean;
  rank?: number;
}

export async function renderLoyaltyCard(options: LoyaltyCardOptions): Promise<Buffer> {
  const width = 850;
  const height = 420;
  const accent = CONSTANTS.COLORS.KICK_GREEN;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Deep Dark Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0a0d0f');
  bgGrad.addColorStop(0.5, '#12161b');
  bgGrad.addColorStop(1, '#080a0c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Kick Neon Glow in top left
  const glow = ctx.createRadialGradient(150, 150, 20, 150, 150, 350);
  glow.addColorStop(0, 'rgba(83, 252, 24, 0.14)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 3. Card Container
  const pad = 20;
  const cardX = pad;
  const cardY = pad;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  const radius = 20;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = '#14181d';
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(83, 252, 24, 0.3)';
  ctx.stroke();
  ctx.restore();

  // 4. Avatar (Left circle with glowing neon border)
  const avatarSize = 110;
  const avatarX = cardX + 30;
  const avatarY = cardY + 35;

  let avatarImage: Image | null = null;
  if (options.avatarUrl) {
    try {
      avatarImage = await loadImage(options.avatarUrl);
    } catch {
      avatarImage = null;
    }
  }

  ctx.save();
  // Outer Ring
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Clip Image
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  if (avatarImage) {
    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#263238';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.font = 'bold 45px "Arial", sans-serif';
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((options.kickUsername[0] || 'K').toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();

  // 5. User Details
  const textX = avatarX + avatarSize + 25;
  ctx.save();

  // Kick Username
  ctx.font = 'bold 30px "Arial", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`@${options.kickUsername}`, textX, avatarY + 5);

  // Discord Name
  ctx.font = '16px "Arial", sans-serif';
  ctx.fillStyle = '#90a4ae';
  ctx.fillText(`Discord: ${options.discordUsername}`, textX, avatarY + 45);

  // Status Badges (Sub / VIP / Rank)
  let badgeX = textX;
  const badgeY = avatarY + 75;

  if (options.isSubscribed) {
    drawBadge(ctx, badgeX, badgeY, '💎 ABONE', accent, '#000000');
    badgeX += 95;
  }
  if (options.isVip) {
    drawBadge(ctx, badgeX, badgeY, '👑 VIP', '#ffd54f', '#000000');
    badgeX += 75;
  }
  if (options.rank) {
    drawBadge(ctx, badgeX, badgeY, `🏆 SIRA #${options.rank}`, '#90caf9', '#000000');
  }

  ctx.restore();

  // 6. Stats Ribbon (Points, Watch Time, Messages)
  const statsY = cardY + cardH - 120;
  const statBoxH = 85;
  const gap = 16;
  const statBoxW = (cardW - 60 - gap * 2) / 3;

  const hours = Math.floor(options.totalWatchMinutes / 60);
  const mins = options.totalWatchMinutes % 60;
  const timeStr = hours > 0 ? `${hours}s ${mins}dk` : `${mins} dakika`;

  renderLoyaltyBox(ctx, cardX + 30, statsY, statBoxW, statBoxH, '⭐ SADAKAT PUANI', `${formatNumber(options.loyaltyPoints)}`, accent);
  renderLoyaltyBox(ctx, cardX + 30 + statBoxW + gap, statsY, statBoxW, statBoxH, '⏱️ İZLENME SÜRESİ', timeStr, '#ffffff');
  renderLoyaltyBox(ctx, cardX + 30 + (statBoxW + gap) * 2, statsY, statBoxW, statBoxH, '💬 SOHBET MESAJI', `${formatNumber(options.messagesSent)}`, '#81d4fa');

  return canvas.toBuffer('image/png');
}

function drawBadge(ctx: any, x: number, y: number, text: string, bgColor: string, textColor: string) {
  ctx.save();
  ctx.font = 'bold 12px "Arial", sans-serif';
  const metrics = ctx.measureText(text);
  const w = metrics.width + 16;
  const h = 24;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.restore();
}

function renderLoyaltyBox(ctx: any, x: number, y: number, w: number, h: number, label: string, value: string, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fillStyle = '#1a1f26';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 12px "Arial", sans-serif';
  ctx.fillStyle = '#78909c';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 16, y + 16);

  ctx.font = 'bold 24px "Arial", sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(value, x + 16, y + 42);
  ctx.restore();
}
