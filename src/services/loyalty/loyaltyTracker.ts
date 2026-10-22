import { Client } from 'discord.js';
import { prisma } from '../../database/client.js';
import { logger } from '../../utils/logger.js';

export class LoyaltyTracker {
  private client: Client;
  private timer?: NodeJS.Timeout;
  private isTicking = false;
  // Anti-Spam: Kick chat mesajları için kullanıcı başına 60 saniye puan cooldown'ı
  private chatCooldowns = new Map<string, number>();

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Starts the 1-minute loyalty points and watch-time accumulation tick
   */
  startLoyaltyEngine(intervalMinutes: number = 1) {
    if (this.timer) {
      clearInterval(this.timer);
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    this.timer = setInterval(() => {
      this.tickLoyalty().catch((err) => {
        logger.error('LOYALTY_TRACKER', 'Sadakat motoru döngü hatası:', err);
      });
    }, intervalMs);

    logger.success('LOYALTY_TRACKER', `Otomatik Sadakat & İzlenme Süresi Motoru aktif (${intervalMinutes} dk aralıkla).`);
  }

  stopLoyaltyEngine() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Called when a chat message is received from Kick
   * Implements 60-second cooldown per user to prevent chat spam point farming!
   */
  async recordKickChatMessage(kickUsername: string) {
    try {
      const lowerUsername = kickUsername.toLowerCase();
      const now = Date.now();
      const lastRewarded = this.chatCooldowns.get(lowerUsername) || 0;
      const canEarnPoints = now - lastRewarded >= 60000; // 60 saniyelik bekleme süresi

      const userLinks = await prisma.userLink.findMany({
        where: {
          kickUsername: { equals: lowerUsername },
          isVerified: true,
        },
      });

      for (const link of userLinks) {
        // Her mesajda mesaj sayısını artır, ancak puanı sadece cooldown dolduysa ver (+5 Puan)
        const pointsToAdd = canEarnPoints ? 5 : 0;

        await prisma.userStreamStats.upsert({
          where: { userLinkId: link.id },
          update: {
            messagesSent: { increment: 1 },
            loyaltyPoints: pointsToAdd > 0 ? { increment: pointsToAdd } : undefined,
            lastSeenAt: new Date(),
          },
          create: {
            userLinkId: link.id,
            messagesSent: 1,
            loyaltyPoints: pointsToAdd,
            totalWatchMinutes: 1,
            lastSeenAt: new Date(),
          },
        });

        if (canEarnPoints) {
          this.chatCooldowns.set(lowerUsername, now);
          logger.debug('LOYALTY_TRACKER', `Kick sohbet puanı eklendi: @${kickUsername} (+5 Puan)`);
        }
      }
    } catch (error) {
      logger.error('LOYALTY_TRACKER', `Sohbet puanı kaydedilirken hata (@${kickUsername}):`, error);
    }
  }

  /**
   * Periodic loyalty tick: runs while streams are live
   * Awards watch minutes and points to:
   * 1. Users active in Kick chat recently (last 15 minutes)
   * 2. Users active in Discord voice channels during the stream
   *
   * Anti-Exploit:
   * - AFK kanalındaki kullanıcılara puan verilmez.
   * - Kulaklığı kapalı (sağırlaştırılmış / selfDeaf / serverDeaf) olanlara puan verilmez.
   */
  async tickLoyalty() {
    if (this.isTicking) return;
    this.isTicking = true;

    try {
      // Find all guilds that currently have an active live stream
      const activeSessions = await prisma.streamSession.findMany({
        where: { isLive: true },
        include: { guild: true },
      });

      if (activeSessions.length === 0) return;

      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      for (const session of activeSessions) {
        const guild = await this.client.guilds.fetch(session.guildId).catch(() => null);
        if (!guild) continue;

        // 1. Get all linked users in this guild
        const linkedUsers = await prisma.userLink.findMany({
          where: { guildId: session.guildId, isVerified: true },
          include: { stats: true },
        });

        // 2. Collect IDs of users currently in Discord voice channels in this guild
        // Filtreleme: Bot olmayan, AFK kanalında olmayan ve sağırlaştırılmamış (kulaklığı açık) kullanıcılar
        const activeVoiceUserIds = new Set<string>();
        guild.voiceStates.cache.forEach((vs) => {
          const isAfkChannel = guild.afkChannelId && vs.channelId === guild.afkChannelId;
          const isDeafened = Boolean(vs.deaf || vs.selfDeaf);

          if (
            vs.member &&
            !vs.member.user.bot &&
            vs.channelId &&
            !isAfkChannel &&
            !isDeafened
          ) {
            activeVoiceUserIds.add(vs.id);
          }
        });

        for (const user of linkedUsers) {
          const isVoiceActive = activeVoiceUserIds.has(user.discordUserId);
          const isRecentlyActiveInChat = Boolean(
            user.stats?.lastSeenAt && user.stats.lastSeenAt >= fifteenMinutesAgo
          );

          // If user is either in voice (active & listening) or has chatted recently on Kick
          if (isVoiceActive || isRecentlyActiveInChat) {
            // Subscribers get 1.5x bonus points!
            const pointsToAdd = user.isSubscribed ? 15 : 10;

            await prisma.userStreamStats.upsert({
              where: { userLinkId: user.id },
              update: {
                totalWatchMinutes: { increment: 1 },
                loyaltyPoints: { increment: pointsToAdd },
                lastSeenAt: new Date(),
              },
              create: {
                userLinkId: user.id,
                totalWatchMinutes: 1,
                loyaltyPoints: pointsToAdd,
                lastSeenAt: new Date(),
              },
            });
          }
        }
      }
    } catch (error) {
      logger.error('LOYALTY_TRACKER', 'Sadakat artırımında hata oluştu:', error);
    } finally {
      this.isTicking = false;
    }
  }
}
