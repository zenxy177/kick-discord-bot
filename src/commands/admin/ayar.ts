import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { CONSTANTS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('ayar')
  .setDescription('Kick canlı yayın, rol, kanal ve duyuru ayarlarını yapılandırın.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    return interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
  }

  // Get or create guild configuration
  const config = await prisma.guildConfig.upsert({
    where: { guildId: interaction.guildId },
    update: {},
    create: {
      guildId: interaction.guildId,
      accentColor: CONSTANTS.COLORS.KICK_GREEN,
    },
  });

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Kick Bot Sunucu Yönetim Paneli')
    .setColor(CONSTANTS.COLORS.KICK_GREEN as any)
    .setDescription(
      'Aşağıdaki menüleri ve butonları kullanarak yayıncınızı, bildirim kanallarını ve otomatik abone/VIP rollerini ayarlayabilirsiniz.\n\n' +
      `**🟢 Takip Edilen Kick Kanalı:** ${config.kickChannelSlug ? `[\`${config.kickChannelSlug}\`](https://kick.com/${config.kickChannelSlug})` : '⚠️ *Ayarlanmadı*'}\n` +
      `**📢 Bildirim Kanalı:** ${config.notificationChannelId ? `<#${config.notificationChannelId}>` : '⚠️ *Ayarlanmadı*'}\n` +
      `**🔔 Bildirim Rolü:** ${config.notificationRoleId ? `<@&${config.notificationRoleId}>` : '`@everyone` (Varsayılan)'}\n` +
      `**✍️ Duyuru Metni:** \`${config.customAnnouncementMessage || '@everyone Yayındayızzz'}\`\n` +
      `**💎 Abone Rolü:** ${config.subscriberRoleId ? `<@&${config.subscriberRoleId}>` : '⚠️ *Ayarlanmadı*'}\n` +
      `**👑 VIP Rolü:** ${config.vipRoleId ? `<@&${config.vipRoleId}>` : '⚠️ *Ayarlanmadı*'}\n` +
      `**🎬 Klipler Kanalı:** ${config.clipChannelId ? `<#${config.clipChannelId}>` : '⚠️ *Ayarlanmadı*'}\n` +
      `**⏱️ Mesaj Güncelleme:** Her ${config.updateIntervalMinutes} dakikada bir`
    )
    .setFooter({ text: 'Kick Bot • Değişiklikler anında veritabanına kaydedilir.' });

  // 1. Channel Select: Notification Channel
  const notifChannelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('setup_notif_channel')
      .setPlaceholder('📢 Canlı Yayın Bildirim Kanalını Seçin')
      .setChannelTypes(ChannelType.GuildText)
  );

  // 2. Role Select: Subscriber Role
  const subRoleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('setup_sub_role')
      .setPlaceholder('💎 Kick Abone Rolünü Seçin')
  );

  // 3. Role Select: Notification Role (@everyone override)
  const notifRoleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('setup_notif_role')
      .setPlaceholder('🔔 Bildirim Rolünü Seçin (@everyone yerine)')
  );

  // 4. Action Buttons (Set Streamer, Set Clip Channel, Edit Text)
  const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_btn_set_streamer')
      .setLabel('Kick Yayıncısı')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId('setup_btn_custom_msg')
      .setLabel('Duyuru Metni')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✍️'),
    new ButtonBuilder()
      .setCustomId('setup_btn_clip_channel')
      .setLabel('Klipler Kanalı')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎬')
  );

  await interaction.reply({
    embeds: [embed],
    components: [notifChannelSelect, subRoleSelect, notifRoleSelect, buttonsRow],
    ephemeral: true,
  });
}
