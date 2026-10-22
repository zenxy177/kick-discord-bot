import fs from 'fs';
import path from 'path';
import {
  Client,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  EmbedBuilder,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { CONSTANTS } from '../../config/constants.js';
import { formatNumber } from '../../utils/timeFormatter.js';
import { logger } from '../../utils/logger.js';

export interface StartStreamParams {
  guildId: string;
  streamerName: string;
  slug: string;
  avatarUrl?: string;
  streamTitle: string;
  category: string;
  viewers: number;
  startedAt?: Date;
  thumbnailUrl?: string;
}

export class LiveNotifier {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async startStream(params: StartStreamParams): Promise<string | null> {
    try {
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: params.guildId },
      });

      if (!guildConfig || !guildConfig.notificationChannelId) {
        logger.warn('LIVE_NOTIFIER', `Bildirim kanalı ayarlanmamış (${params.guildId})`);
        return null;
      }

      const channel = await this.client.channels.fetch(guildConfig.notificationChannelId).catch(() => null) as TextChannel | null;
      if (!channel || !channel.isTextBased()) {
        logger.warn('LIVE_NOTIFIER', `Bildirim kanalı bulunamadı (${guildConfig.notificationChannelId})`);
        return null;
      }

      const startedAt = params.startedAt || new Date();
      const kickUrl = `https://kick.com/${params.slug}`;

      // 1. Build Discord Embed exactly matching Kick / BotRix style
      const embed = new EmbedBuilder()
        .setColor(CONSTANTS.COLORS.KICK_GREEN as any)
        .setAuthor({
          name: params.streamerName,
          iconURL: params.avatarUrl || undefined,
          url: kickUrl,
        })
        .setTitle(params.streamTitle)
        .setURL(kickUrl)
        .addFields(
          { name: 'Category', value: params.category || 'Just Chatting', inline: true },
          { name: 'Anlık İzleyici', value: `👥 ${formatNumber(params.viewers)}`, inline: true }
        );

      if (params.avatarUrl) {
        embed.setThumbnail(params.avatarUrl);
      }

      const files: AttachmentBuilder[] = [];

      // 2. Set Large Main Image (Kick live stream preview OR retro Kick banner)
      if (params.thumbnailUrl && params.thumbnailUrl.startsWith('http')) {
        embed.setImage(params.thumbnailUrl);
      } else {
        const defaultBannerPath = path.resolve(process.cwd(), 'assets', 'kick-default-banner.png');
        if (fs.existsSync(defaultBannerPath)) {
          const bannerAttachment = new AttachmentBuilder(defaultBannerPath, { name: 'kick-banner.png' });
          files.push(bannerAttachment);
          embed.setImage('attachment://kick-banner.png');
        }
      }

      // 3. Action Button (Watch on Kick)
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Watch on Kick')
          .setStyle(ButtonStyle.Link)
          .setURL(kickUrl)
          .setEmoji('↗️')
      );

      // 4. Build Custom Announcement Text with variables ({yayinci}, {baslik}, {kategori}, {rol})
      let announcement = guildConfig.customAnnouncementMessage || '@everyone Yayındayızzz';
      const roleMention = guildConfig.notificationRoleId ? `<@&${guildConfig.notificationRoleId}>` : '@everyone';

      announcement = announcement
        .replace(/{rol}/gi, roleMention)
        .replace(/{yayinci}/gi, params.streamerName)
        .replace(/{baslik}/gi, params.streamTitle)
        .replace(/{kategori}/gi, params.category);

      if (guildConfig.notificationRoleId && !announcement.includes(guildConfig.notificationRoleId)) {
        announcement = announcement.replace(/@everyone/g, roleMention);
      }

      // 5. Send Discord Message
      const message = await channel.send({
        content: announcement,
        embeds: [embed],
        files,
        components: [row],
      });

      // 5. Record StreamSession in Database
      const session = await prisma.streamSession.create({
        data: {
          guildId: params.guildId,
          kickChannelSlug: params.slug,
          streamTitle: params.streamTitle,
          categoryName: params.category,
          startedAt,
          peakViewers: params.viewers,
          currentViewers: params.viewers,
          discordChannelId: channel.id,
          discordMessageId: message.id,
          isLive: true,
        },
      });

      logger.success(
        'LIVE_NOTIFIER',
        `Canlı yayın bildirimi gönderildi: ${params.streamerName} (Mesaj ID: ${message.id})`
      );

      return session.id;
    } catch (error) {
      logger.error('LIVE_NOTIFIER', 'Yayın bildirimi gönderilemedi:', error);
      return null;
    }
  }
}
