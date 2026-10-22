import {
  Client,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { kickClient, KickClipItem } from '../kick/kickClient.js';
import { CONSTANTS } from '../../config/constants.js';
import { formatNumber } from '../../utils/timeFormatter.js';
import { logger } from '../../utils/logger.js';

export class ClipWatcher {
  private client: Client;
  private timer?: NodeJS.Timeout;
  private isChecking = false;
  private postedClipCache = new Set<string>();

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Initializes the persistent SQLite table and loads existing clip history
   */
  async initDatabase(): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS posted_clips (
          id TEXT PRIMARY KEY,
          guild_id TEXT,
          clip_id TEXT,
          title TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const rows = await prisma.$queryRawUnsafe<Array<{ guild_id: string; clip_id: string }>>(
        'SELECT guild_id, clip_id FROM posted_clips ORDER BY created_at DESC LIMIT 500;'
      );

      for (const row of rows) {
        this.postedClipCache.add(`${row.guild_id}:${row.clip_id}`);
      }

      logger.info('CLIP_WATCHER', `Klip takip veritabanı hazır (${rows.length} geçmiş klip hafızada).`);
    } catch (err) {
      logger.error('CLIP_WATCHER', 'posted_clips tablosu başlatılamadı:', err);
    }
  }

  /**
   * Starts periodic polling for new Kick clips (default: every 60 seconds)
   */
  startPolling(intervalSeconds: number = 60) {
    if (this.timer) {
      clearInterval(this.timer);
    }

    // Run first check after a brief 5-second wait to allow bot fully settle
    setTimeout(() => {
      this.checkAllClips().catch((err) => {
        logger.error('CLIP_WATCHER', 'İlk klip kontrolünde hata:', err);
      });
    }, 5000);

    const intervalMs = intervalSeconds * 1000;
    this.timer = setInterval(() => {
      this.checkAllClips().catch((err) => {
        logger.error('CLIP_WATCHER', 'Klip kontrol döngüsünde hata:', err);
      });
    }, intervalMs);

    logger.success('CLIP_WATCHER', `Otomatik Kick Klip Takip servisi aktif (${intervalSeconds} sn aralıkla).`);
  }

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Checks every configured Discord guild and handles new clips
   */
  async checkAllClips() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const configs = await prisma.guildConfig.findMany({
        where: {
          kickChannelSlug: { not: null },
          clipChannelId: { not: null },
        },
      });

      for (const config of configs) {
        if (!config.kickChannelSlug || !config.clipChannelId) continue;
        const slug = config.kickChannelSlug.trim().toLowerCase();

        const channel = await this.client.channels.fetch(config.clipChannelId).catch(() => null) as TextChannel | null;
        if (!channel || !channel.isTextBased()) continue;

        const clips = await kickClient.getRecentClips(slug);
        if (!clips || clips.length === 0) continue;

        // Process from oldest to newest so they appear in chronological order
        const chronologicalClips = [...clips].reverse();

        for (const clip of chronologicalClips) {
          const cacheKey = `${config.guildId}:${clip.id}`;
          if (this.postedClipCache.has(cacheKey)) continue;

          // Double check database to prevent duplicates
          const existing = await prisma.$queryRawUnsafe<any[]>(
            'SELECT 1 FROM posted_clips WHERE guild_id = ? AND clip_id = ? LIMIT 1;',
            config.guildId,
            clip.id
          );
          if (existing && existing.length > 0) {
            this.postedClipCache.add(cacheKey);
            continue;
          }

          // Age filter: ignore clips older than 24 hours to prevent spamming months-old archives
          const clipTime = new Date(clip.created_at).getTime();
          const ageMs = Date.now() - clipTime;
          const maxAgeMs = 24 * 60 * 60 * 1000;

          if (isNaN(clipTime) || ageMs > maxAgeMs) {
            this.postedClipCache.add(cacheKey);
            continue;
          }

          // Post to Discord!
          await this.postClipToDiscord(channel, config.guildId, clip, slug);
        }
      }
    } catch (error) {
      logger.error('CLIP_WATCHER', 'Klip kontrolü sırasında hata oluştu:', error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Builds rich Discord embed and sends clip to configured channel
   */
  private async postClipToDiscord(
    channel: TextChannel,
    guildId: string,
    clip: KickClipItem,
    slug: string
  ) {
    try {
      const clipWatchUrl = `https://kick.com/${slug}/clips/${clip.id}`;
      const creatorName = clip.creator?.username || 'Kick İzleyicisi';
      const categoryName = clip.category?.name || 'Just Chatting';
      const streamerName = clip.channel?.username || slug;
      const unixTime = Math.floor(new Date(clip.created_at).getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(CONSTANTS.COLORS.KICK_GREEN as any)
        .setAuthor({
          name: `🎬 Yeni Kick Klibi | ${creatorName}`,
          iconURL: clip.channel?.profile_picture || undefined,
          url: clipWatchUrl,
        })
        .setTitle(clip.title || 'Başlıksız Klip')
        .setURL(clipWatchUrl)
        .addFields(
          { name: '📺 Yayıncı', value: `\`@${streamerName}\``, inline: true },
          { name: '🎮 Kategori', value: categoryName, inline: true },
          { name: '⏱️ Süre', value: `${clip.duration || 30} sn`, inline: true },
          { name: '👁️ İzlenme', value: `${formatNumber(clip.view_count || 0)}`, inline: true },
          { name: '📅 Tarih', value: unixTime ? `<t:${unixTime}:R>` : 'Az önce', inline: true }
        );

      if (clip.thumbnail_url) {
        embed.setImage(clip.thumbnail_url);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Klibi Kick'te İzle")
          .setStyle(ButtonStyle.Link)
          .setURL(clipWatchUrl)
          .setEmoji('▶️')
      );

      await channel.send({
        content: `🍿 **Yeni bir Kick klibi paylaşıldı!**`,
        embeds: [embed],
        components: [row],
      });

      // Save to database
      const rowId = `${guildId}_${clip.id}`;
      await prisma.$executeRawUnsafe(
        'INSERT OR REPLACE INTO posted_clips (id, guild_id, clip_id, title) VALUES (?, ?, ?, ?);',
        rowId,
        guildId,
        clip.id,
        clip.title || ''
      );

      const cacheKey = `${guildId}:${clip.id}`;
      this.postedClipCache.add(cacheKey);

      logger.success('CLIP_WATCHER', `✔ Yeni klip kanala gönderildi: "${clip.title}" (${clip.id}) -> #${channel.name}`);
    } catch (err) {
      logger.error('CLIP_WATCHER', `Klip gönderilirken hata oluştu (${clip.id}):`, err);
    }
  }
}
