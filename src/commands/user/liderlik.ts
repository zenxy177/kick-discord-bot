import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { CONSTANTS } from '../../config/constants.js';
import { formatNumber } from '../../utils/timeFormatter.js';

export const data = new SlashCommandBuilder()
  .setName('liderlik')
  .setDescription('Sunucudaki en aktif Kick izleyicileri ve sadakat puanı liderlik tablosunu gösterir.')
  .addStringOption((opt) =>
    opt
      .setName('tur')
      .setDescription('Sıralama ölçütü')
      .addChoices(
        { name: '⭐ Sadakat Puanı', value: 'puan' },
        { name: '⏱️ Toplam İzlenme Süresi', value: 'sure' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  await interaction.deferReply();

  const sortType = interaction.options.getString('tur') || 'puan';

  // Fetch all linked users in this guild with their stats
  const userLinks = await prisma.userLink.findMany({
    where: { guildId, isVerified: true },
    include: { stats: true },
  });

  if (userLinks.length === 0) {
    return interaction.editReply({
      content: '⚠️ Bu sunucuda henüz Kick hesabını eşlemiş kullanıcı bulunmuyor. `/hesap-bagla baslat` komutuyla ilk eşleyen sen ol!',
    });
  }

  // Sort by points or watch time
  const sorted = [...userLinks].sort((a, b) => {
    if (sortType === 'sure') {
      return (b.stats?.totalWatchMinutes || 0) - (a.stats?.totalWatchMinutes || 0);
    }
    return (b.stats?.loyaltyPoints || 0) - (a.stats?.loyaltyPoints || 0);
  });

  const medals = ['🥇', '🥈', '🥉'];
  let description = '';

  const top10 = sorted.slice(0, 10);
  top10.forEach((user, index) => {
    const rank = index < 3 ? medals[index] : `**#${index + 1}**`;
    const watchMinutes = user.stats?.totalWatchMinutes || 0;
    const hours = Math.floor(watchMinutes / 60);
    const mins = watchMinutes % 60;
    const points = formatNumber(user.stats?.loyaltyPoints || 0);

    const subBadge = user.isSubscribed ? ' 💎 [Abone]' : '';
    const vipBadge = user.isVip ? ' 👑 [VIP]' : '';

    description += `${rank} <@${user.discordUserId}> (\`@${user.kickUsername || 'Bilinmiyor'}\`)${subBadge}${vipBadge}\n`;
    if (sortType === 'sure') {
      description += `   └ ⏱️ **${hours}s ${mins}dk** izlenme • ⭐ ${points} puan\n\n`;
    } else {
      description += `   └ ⭐ **${points} puan** • ⏱️ ${hours}s ${mins}dk izlenme\n\n`;
    }
  });

  // Check caller's personal rank
  const callerIndex = sorted.findIndex((u) => u.discordUserId === interaction.user.id);
  let callerRankText = 'Henüz hesabınızı bağlamadınız (/hesap-bagla)';
  if (callerIndex !== -1) {
    callerRankText = `Sizin Sıralamanız: #${callerIndex + 1} / ${sorted.length}`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Kick Sadakat Liderlik Tablosu (${sortType === 'sure' ? 'İzlenme Süresi' : 'Sadakat Puanı'})`)
    .setColor(CONSTANTS.COLORS.KICK_GREEN as any)
    .setDescription(description || 'Henüz kayıt bulunamadı.')
    .setFooter({ text: callerRankText });

  return interaction.editReply({ embeds: [embed] });
}
