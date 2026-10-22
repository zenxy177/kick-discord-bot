import fs from 'fs';
import path from 'path';
import {
  Client,
  AttachmentBuilder,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { renderSummaryCard } from '../canvas/summaryCardRenderer.js';
import { kickClient } from '../kick/kickClient.js';
import { CONSTANTS } from '../../config/constants.js';
import { formatNumber, formatDuration } from '../../utils/timeFormatter.js';
import { logger } from '../../utils/logger.js';

export class MessageUpdater {
  private client: Client;
  private intervalTimer?: NodeJS.Timeout;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Starts periodic polling / message updating loop (e.g. every 5 minutes)
   */
  startPeriodicUpdates(intervalMinutes: number = 5) {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    this.intervalTimer = setInterval(() => {
      this.updateActiveSessions().catch((err) => {
        logger.error('MESSAGE_UPDATER', 'Aktif yayınları güncellerken hata oluştu:', err);
      });
    }, intervalMs);

    logger.info('MESSAGE_UPDATER', `Otomatik mesaj güncelleyici başlatıldı (${intervalMinutes} dk aralıkla).`);
  }

  stopPeriodicUpdates() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
  }

  /**
   * Updates all active live sessions across all guilds
   */
  async updateActiveSessions() {
    const activeSessions = await prisma.streamSession.findMany({
      where: { isLive: true },
      include: { guild: true },
    });

    for (const session of activeSessions) {
      try {
        const kickData = await kickClient.getChannel(session.kickChannelSlug);
        if (!kickData) {
          // Geçici ağ veya API hatası, yayını hemen sonlandırma!
          logger.warn('MESSAGE_UPDATER', `Kanal verisi alınamadı (${session.kickChannelSlug}), yayın açık varsayılıyor.`);
          continue;
        }

        if (!kickData.is_live) {
          // Stream confirmed ended on Kick
          await this.endSession(session.id);
        } else {
          // Stream is still live, update viewer count and live thumbnail
          await this.updateLiveMessage(session.id, {
            viewers: kickData.viewer_count,
            title: kickData.stream_title,
            category: kickData.category_name,
            avatarUrl: kickData.profile_picture,
            thumbnailUrl: kickData.thumbnail_url,
          });
        }
      } catch (err) {
        logger.error('MESSAGE_UPDATER', `Yayın güncelleme hatası (${session.kickChannelSlug}):`, err);
      }
    }
  }

  /**
   * Updates the Discord message with fresh viewer count and stream preview image
   */
  async updateLiveMessage(
    sessionId: string,
    updates: {
      viewers: number;
      title?: string;
      category?: string;
      avatarUrl?: string;
      thumbnailUrl?: string;
    }
  ): Promise<boolean> {
    const session = await prisma.streamSession.findUnique({
      where: { id: sessionId },
      include: { guild: true },
    });

    if (!session || !session.isLive) return false;

    const channel = await this.client.channels.fetch(session.discordChannelId).catch(() => null) as TextChannel | null;
    if (!channel || !channel.isTextBased()) return false;

    const message = await channel.messages.fetch(session.discordMessageId).catch(() => null);
    if (!message) return false;

    const newPeak = Math.max(session.peakViewers, updates.viewers);
    const newTitle = updates.title || session.streamTitle;
    const newCategory = updates.category || session.categoryName;
    const kickUrl = `https://kick.com/${session.kickChannelSlug}`;

    // Update Embed
    const embed = new EmbedBuilder()
      .setColor(CONSTANTS.COLORS.KICK_GREEN as any)
      .setAuthor({
        name: session.kickChannelSlug,
        iconURL: updates.avatarUrl || undefined,
        url: kickUrl,
      })
      .setTitle(newTitle)
      .setURL(kickUrl)
      .addFields(
        { name: 'Category', value: newCategory || 'Just Chatting', inline: true },
        { name: 'Anlık İzleyici', value: `👥 ${formatNumber(updates.viewers)}`, inline: true }
      );

    if (updates.avatarUrl) {
      embed.setThumbnail(updates.avatarUrl);
    }

    const files: AttachmentBuilder[] = [];

    if (updates.thumbnailUrl && updates.thumbnailUrl.startsWith('http')) {
      embed.setImage(updates.thumbnailUrl);
    } else {
      const defaultBannerPath = path.resolve(process.cwd(), 'assets', 'kick-default-banner.png');
      if (fs.existsSync(defaultBannerPath)) {
        const bannerAttachment = new AttachmentBuilder(defaultBannerPath, { name: 'kick-banner.png' });
        files.push(bannerAttachment);
        embed.setImage('attachment://kick-banner.png');
      }
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Watch on Kick')
        .setStyle(ButtonStyle.Link)
        .setURL(kickUrl)
        .setEmoji('↗️')
    );

    // Edit message with fresh info (keep original announcement text)
    await message.edit({
      content: message.content || undefined,
      embeds: [embed],
      files,
      components: [row],
    });

    // Update database
    await prisma.streamSession.update({
      where: { id: sessionId },
      data: {
        currentViewers: updates.viewers,
        peakViewers: newPeak,
        streamTitle: newTitle,
        categoryName: newCategory,
      },
    });

    logger.info('MESSAGE_UPDATER', `Mesaj güncellendi: ${session.kickChannelSlug} (İzleyici: ${updates.viewers})`);
    return true;
  }

  /**
   * Ends a stream session and transforms the message into a Summary Card
   */
  async endSession(
    sessionId: string,
    customSummary?: { peakViewers?: number; endedAt?: Date }
  ): Promise<boolean> {
    const session = await prisma.streamSession.findUnique({
      where: { id: sessionId },
      include: { guild: true },
    });

    if (!session) return false;

    const endedAt = customSummary?.endedAt || new Date();
    const peakViewers = customSummary?.peakViewers || session.peakViewers;
    const kickUrl = `https://kick.com/${session.kickChannelSlug}`;
    const duration = formatDuration(session.startedAt, endedAt);

    const channel = await this.client.channels.fetch(session.discordChannelId).catch(() => null) as TextChannel | null;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(session.discordMessageId).catch(() => null);
      if (message) {
        // Render Summary Card
        const summaryBuffer = await renderSummaryCard({
          streamerName: session.kickChannelSlug,
          streamTitle: session.streamTitle,
          category: session.categoryName,
          startedAt: session.startedAt,
          endedAt,
          peakViewers,
          accentColor: session.guild.accentColor,
        });

        const attachment = new AttachmentBuilder(summaryBuffer, { name: 'kick-summary.png' });

        const embed = new EmbedBuilder()
          .setColor(0x757575)
          .setAuthor({
            name: `${session.kickChannelSlug} - Yayın Sona Erdi`,
            url: kickUrl,
          })
          .setTitle(session.streamTitle)
          .setURL(kickUrl)
          .addFields(
            { name: 'Category', value: session.categoryName || 'Just Chatting', inline: true },
            { name: 'Zirve İzleyici', value: `🏆 ${formatNumber(peakViewers)}`, inline: true },
            { name: 'Toplam Süre', value: `⏳ ${duration}`, inline: true }
          )
          .setImage('attachment://kick-summary.png');

        await message.edit({
          content: `@everyone **${session.kickChannelSlug}** yayını sona erdi!`,
          embeds: [embed],
          files: [attachment],
          components: [], // Remove action buttons on end
        });
      }
    }

    // Update session in DB
    await prisma.streamSession.update({
      where: { id: sessionId },
      data: {
        isLive: false,
        endedAt,
        peakViewers,
      },
    });

    logger.success('MESSAGE_UPDATER', `Yayın sonlandırıldı ve özet kartı atıldı: ${session.kickChannelSlug}`);
    return true;
  }
}
