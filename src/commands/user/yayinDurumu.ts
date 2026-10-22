import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { kickClient } from '../../services/kick/kickClient.js';
import { CONSTANTS } from '../../config/constants.js';
import { formatNumber, formatDuration } from '../../utils/timeFormatter.js';

export const data = new SlashCommandBuilder()
  .setName('yayin-durumu')
  .setDescription('Sunucunun Kick yayıncısının anlık canlı yayın durumunu gösterir.');

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!guildConfig || !guildConfig.kickChannelSlug) {
    return interaction.reply({
      content: '⚠️ Bu sunucuda henüz bir Kick yayıncısı tanımlanmamış. Sunucu yetkilisi `/ayar` komutuyla tanımlayabilir.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const kickData = await kickClient.getChannel(guildConfig.kickChannelSlug);
  const kickUrl = `https://kick.com/${guildConfig.kickChannelSlug}`;

  if (!kickData || !kickData.is_live) {
    const embed = new EmbedBuilder()
      .setTitle(`⚫ ${guildConfig.kickChannelSlug} - Şu Anda Çevrimdışı`)
      .setColor(0x757575)
      .setDescription(`Yayıncı şu anda canlı yayında değil.\nYayın başladığında bu sunucuya anında bildirim gönderilecektir!`)
      .setFooter({ text: 'Kick Bot • Canlı Yayın Takibi' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Kick Kanalına Git")
        .setStyle(ButtonStyle.Link)
        .setURL(kickUrl)
        .setEmoji('🔗')
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  const durationText = kickData.started_at ? `\n⏱️ Yayın Süresi: **${formatDuration(kickData.started_at)}**` : '';

  const embed = new EmbedBuilder()
    .setTitle(`🟢 ${kickData.username} Şu Anda Canlı Yayında!`)
    .setURL(kickUrl)
    .setColor(CONSTANTS.COLORS.KICK_GREEN as any)
    .setDescription(`**${kickData.stream_title}**\n\n🎮 Kategori: **${kickData.category_name}**\n👥 Anlık İzleyici: **${formatNumber(kickData.viewer_count)}**${durationText}`)
    .setFooter({ text: 'Kick Bot • Canlı Yayın Takibi' });

  if (kickData.profile_picture) {
    embed.setThumbnail(kickData.profile_picture);
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Yayını Kick'te İzle")
      .setStyle(ButtonStyle.Link)
      .setURL(kickUrl)
      .setEmoji('🟢')
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}
