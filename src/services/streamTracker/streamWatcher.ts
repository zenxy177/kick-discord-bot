import { Client } from 'discord.js';
import { prisma } from '../../database/client.js';
import { kickClient } from '../kick/kickClient.js';
import { LiveNotifier } from './liveNotifier.js';
import { MessageUpdater } from './messageUpdater.js';
import { parseKickDate } from '../../utils/timeFormatter.js';
import { logger } from '../../utils/logger.js';

export class StreamWatcher {
  private client: Client;
  private timer?: NodeJS.Timeout;
  private isChecking = false;
  private liveNotifier: LiveNotifier;
  private messageUpdater: MessageUpdater;

  constructor(client: Client, liveNotifier: LiveNotifier, messageUpdater: MessageUpdater) {
    this.client = client;
    this.liveNotifier = liveNotifier;
    this.messageUpdater = messageUpdater;
  }

  /**
   * Starts periodic polling for all tracked Kick streamers (every 60-90 seconds)
   * This guarantees that live streams are detected even if the streamer NEVER sets up webhooks or OAuth!
   */
  startPolling(intervalSeconds: number = 60) {
    if (this.timer) {
      clearInterval(this.timer);
    }

    const intervalMs = intervalSeconds * 1000;
    this.timer = setInterval(() => {
      this.checkAllTrackedStreamers().catch((err) => {
        logger.error('STREAM_WATCHER', 'Yayıncı kontrol döngüsünde hata:', err);
      });
    }, intervalMs);

    logger.success('STREAM_WATCHER', `Otomatik Kick Polling (Periyodik Takip) servisi aktif (${intervalSeconds} sn aralıkla).`);
  }

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Checks every configured Discord guild and handles offline <-> live transitions
   */
  async checkAllTrackedStreamers() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const configs = await prisma.guildConfig.findMany({
        where: {
          kickChannelSlug: { not: null },
          notificationChannelId: { not: null },
        },
      });

      for (const config of configs) {
        if (!config.kickChannelSlug || !config.notificationChannelId) continue;
        const slug = config.kickChannelSlug.toLowerCase();

        // 1. Fetch channel info via public Kick API (No OAuth required!)
        const kickData = await kickClient.getChannel(slug);
        if (!kickData) continue;

        // 2. Check current active session in database
        const activeSession = await prisma.streamSession.findFirst({
          where: { guildId: config.guildId, isLive: true },
          orderBy: { createdAt: 'desc' },
        });

        // Case A: Streamer just went live on Kick, but no active session exists in Discord
        if (kickData.is_live && !activeSession) {
          logger.info('STREAM_WATCHER', `🔔 [POLLING] ${slug} canlı yayına başladı! Bildirim gönderiliyor...`);
          await this.liveNotifier.startStream({
            guildId: config.guildId,
            streamerName: kickData.username || slug,
            slug,
            avatarUrl: kickData.profile_picture,
            streamTitle: kickData.stream_title || 'Canlı Yayın Başladı!',
            category: kickData.category_name || 'Just Chatting',
            viewers: kickData.viewer_count || 1,
            startedAt: parseKickDate(kickData.started_at),
            thumbnailUrl: kickData.thumbnail_url,
          });
        }
        // Case B: Stream is still live, update viewer count & latest stream snapshot
        else if (kickData.is_live && activeSession) {
          await this.messageUpdater.updateLiveMessage(activeSession.id, {
            viewers: kickData.viewer_count,
            title: kickData.stream_title,
            category: kickData.category_name,
            avatarUrl: kickData.profile_picture,
            thumbnailUrl: kickData.thumbnail_url,
          });
        }
        // Case C: Streamer went offline, but Discord still has active session
        else if (!kickData.is_live && activeSession) {
          logger.info('STREAM_WATCHER', `🎬 [POLLING] ${slug} yayını kapattı. Özet kartı hazırlanıyor...`);
          await this.messageUpdater.endSession(activeSession.id);
        }
      }
    } catch (error) {
      logger.error('STREAM_WATCHER', 'Yayıncı durumu denetlenirken hata oluştu:', error);
    } finally {
      this.isChecking = false;
    }
  }
}
