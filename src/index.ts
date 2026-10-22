import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { env } from './config/env.js';
import { connectDatabase } from './database/client.js';
import { createFastifyServer, startFastifyServer } from './server/fastify.js';
import { onReady } from './events/ready.js';
import { handleInteraction } from './events/interactionCreate.js';
import { queueService } from './services/queue/index.js';
import { RoleManager } from './services/roleSync/roleManager.js';
import { LiveNotifier } from './services/streamTracker/liveNotifier.js';
import { MessageUpdater } from './services/streamTracker/messageUpdater.js';
import { StreamWatcher } from './services/streamTracker/streamWatcher.js';
import { ClipWatcher } from './services/streamTracker/clipWatcher.js';
import { LoyaltyTracker } from './services/loyalty/loyaltyTracker.js';
import { prisma } from './database/client.js';
import { logger } from './utils/logger.js';
import { parseKickDate } from './utils/timeFormatter.js';

async function main() {
  console.log(`
\x1b[32m  _  ___      _      ____        _   
 | |/ (_) ___| | __ | __ )  ___ | |_ 
 | ' /| |/ __| |/ / |  _ \\ / _ \\| __|
 | . \\| | (__|   <  | |_) | (_) | |_ 
 |_|\\_\\_|\\___|_|\\_\\ |____/ \\___/ \\__|
\x1b[0m\x1b[90m      Kick.com Discord Entegrasyon Motoru\x1b[0m
  `);

  // 1. Connect SQLite/PostgreSQL Database via Prisma
  await connectDatabase();

  // 2. Initialize Discord Client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
    ],
  });

  const roleManager = new RoleManager(client);
  const liveNotifier = new LiveNotifier(client);
  const messageUpdater = new MessageUpdater(client);
  const streamWatcher = new StreamWatcher(client, liveNotifier, messageUpdater);
  const clipWatcher = new ClipWatcher(client);
  await clipWatcher.initDatabase();
  const loyaltyTracker = new LoyaltyTracker(client);

  // 3. Register Queue Job Processors
  queueService.processJobs('kick.chat.message', async (data: any) => {
    if (data.sender) {
      await loyaltyTracker.recordKickChatMessage(data.sender);
    }
  });
  queueService.processJobs('kick.sub.sync', async (data: any) => {
    logger.info('QUEUE_WORKER', `Abone senkronizasyon işi işleniyor: ${JSON.stringify(data)}`);
    if (data.guildId && data.discordUserId) {
      await roleManager.syncUserRoles(data.guildId, data.discordUserId);
    }
  });

  queueService.processJobs('kick.stream.start', async (data: any) => {
    logger.info('QUEUE_WORKER', `Canlı yayın başlangıç işi işleniyor: ${data.slug || data.streamerName}`);
    // Find guild configs that track this slug
    const slug = (data.slug || data.streamerName || '').toLowerCase();
    const configs = await prisma.guildConfig.findMany({
      where: { kickChannelSlug: slug },
    });

    for (const config of configs) {
      await liveNotifier.startStream({
        guildId: config.guildId,
        streamerName: data.streamerName || slug,
        slug,
        avatarUrl: data.avatarUrl,
        streamTitle: data.title || 'Canlı Yayın Başladı!',
        category: data.category || 'Just Chatting',
        viewers: Number(data.viewers || 1),
        startedAt: parseKickDate(data.startedAt),
      });
    }
  });

  queueService.processJobs('kick.stream.end', async (data: any) => {
    logger.info('QUEUE_WORKER', `Yayın sonlandırma işi işleniyor: ${data.slug}`);
    const slug = (data.slug || '').toLowerCase();
    const activeSessions = await prisma.streamSession.findMany({
      where: { kickChannelSlug: slug, isLive: true },
    });

    for (const session of activeSessions) {
      await messageUpdater.endSession(session.id);
    }
  });

  queueService.processJobs('kick.clip', async (data: any) => {
    logger.info('QUEUE_WORKER', `Yeni klip işleniyor: ${data.title || data.clipUrl}`);
    const slug = (data.slug || data.streamerName || '').toLowerCase();
    const clipId = data.id || data.clipId;
    const configs = await prisma.guildConfig.findMany({
      where: slug ? { kickChannelSlug: slug } : {},
    });

    for (const config of configs) {
      if (!config.clipChannelId) continue;

      if (clipId) {
        const existing = await prisma.$queryRawUnsafe<any[]>(
          'SELECT 1 FROM posted_clips WHERE guild_id = ? AND clip_id = ? LIMIT 1;',
          config.guildId,
          clipId
        );
        if (existing && existing.length > 0) continue;
      }

      const channel = await client.channels.fetch(config.clipChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      const embed = new EmbedBuilder()
        .setColor(0x53FC18)
        .setAuthor({
          name: `🎬 Yeni Kick Klibi | ${data.creatorName || 'Bir İzleyici'}`,
          iconURL: data.creatorAvatar || undefined,
        })
        .setTitle(data.title || 'Başlıksız Klip')
        .setURL(data.clipUrl || `https://kick.com/${slug}`)
        .addFields(
          { name: '📺 Yayıncı', value: `\`@${slug || config.kickChannelSlug || 'Yayıncı'}\``, inline: true },
          { name: '⏱️ Süre', value: `${data.duration || 30} sn`, inline: true },
          { name: '👁️ İzlenme', value: `${data.views || 1}`, inline: true }
        );

      if (data.thumbnailUrl) {
        embed.setImage(data.thumbnailUrl);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Klibi Kick'te İzle")
          .setStyle(ButtonStyle.Link)
          .setURL(data.clipUrl || `https://kick.com/${slug}`)
          .setEmoji('▶️')
      );

      await (channel as any).send({
        content: `🍿 **Yeni bir klip paylaşıldı!**`,
        embeds: [embed],
        components: [row],
      });

      if (clipId) {
        await prisma.$executeRawUnsafe(
          'INSERT OR REPLACE INTO posted_clips (id, guild_id, clip_id, title) VALUES (?, ?, ?, ?);',
          `${config.guildId}_${clipId}`,
          config.guildId,
          clipId,
          data.title || ''
        );
      }
    }
  });

  // 4. Register Discord Client Events
  client.on('ready', async () => {
    await onReady(client);
    streamWatcher.startPolling(60); // 60 saniyede bir yayın durumunu otomatik denetler
    clipWatcher.startPolling(60); // 60 saniyede bir yeni klipleri otomatik denetler ve paylaşır
    loyaltyTracker.startLoyaltyEngine(1); // Dakikada bir sadakat puanı ve izlenme süresini artırır
  });

  client.on('interactionCreate', async (interaction) => {
    await handleInteraction(interaction);
  });

  // 5. Start Fastify Webhook & OAuth HTTP Server
  const fastifyApp = createFastifyServer();
  await startFastifyServer(fastifyApp);

  // 6. Connect Discord Bot if token is provided
  if (env.DISCORD_TOKEN && env.DISCORD_TOKEN.trim().length > 0) {
    logger.info('DISCORD', 'Discord botuna bağlanılıyor...');
    try {
      await client.login(env.DISCORD_TOKEN);
    } catch (err: any) {
      logger.error('DISCORD', 'Bot Discord\'a bağlanamadı! Token\'ı kontrol edin:', err.message);
    }
  } else {
    logger.warn(
      'CONFIG',
      'DISCORD_TOKEN henüz .env dosyasında tanımlanmamış. Bot Discord\'a bağlanmadı ancak Fastify HTTP sunucusu ve simülasyon motoru hazır durumda.'
    );
  }
}

main().catch((err) => {
  logger.error('MAIN', 'Uygulama başlatılırken kritik hata:', err);
  process.exit(1);
});
