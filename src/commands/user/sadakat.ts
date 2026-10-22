import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { renderLoyaltyCard } from '../../services/canvas/loyaltyCardRenderer.js';

export const data = new SlashCommandBuilder()
  .setName('sadakat')
  .setDescription('Kick yayınındaki izlenme sürenizi ve sadakat puanlarınızı görsel kart olarak görüntüler.')
  .addUserOption((opt) => opt.setName('kullanici').setDescription('İstatistikleri görüntülenecek kullanıcı (varsayılan: siz)'));

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const targetUser = interaction.options.getUser('kullanici') || interaction.user;

  const userLink = await prisma.userLink.findUnique({
    where: {
      guildId_discordUserId: { guildId, discordUserId: targetUser.id },
    },
    include: { stats: true },
  });

  if (!userLink || !userLink.isVerified) {
    return interaction.reply({
      content: targetUser.id === interaction.user.id
        ? '⚠️ Henüz Kick hesabınızı bağlamamışsınız! `/hesap-bagla baslat` komutunu kullanarak bağlayabilirsiniz.'
        : `⚠️ <@${targetUser.id}> henüz Kick hesabını bağlamamış.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  // Find user's rank in this guild
  const allLinks = await prisma.userLink.findMany({
    where: { guildId, isVerified: true },
    include: { stats: true },
  });

  const sorted = allLinks.sort((a, b) => (b.stats?.loyaltyPoints || 0) - (a.stats?.loyaltyPoints || 0));
  const userRank = sorted.findIndex((u) => u.discordUserId === targetUser.id) + 1;

  // Render Canvas Card
  const cardBuffer = await renderLoyaltyCard({
    discordUsername: targetUser.username,
    kickUsername: userLink.kickUsername || targetUser.username,
    avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
    totalWatchMinutes: userLink.stats?.totalWatchMinutes || 0,
    loyaltyPoints: userLink.stats?.loyaltyPoints || 0,
    messagesSent: userLink.stats?.messagesSent || 0,
    isSubscribed: userLink.isSubscribed,
    isVip: userLink.isVip,
    rank: userRank > 0 ? userRank : undefined,
  });

  const attachment = new AttachmentBuilder(cardBuffer, { name: 'loyalty-card.png' });

  return interaction.editReply({
    files: [attachment],
  });
}
