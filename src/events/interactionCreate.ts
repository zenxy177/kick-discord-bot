import {
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
} from 'discord.js';
import { prisma } from '../database/client.js';
import { LiveNotifier } from '../services/streamTracker/liveNotifier.js';
import * as ayarCommand from '../commands/admin/ayar.js';
import * as hesapBaglaCommand from '../commands/user/hesapBagla.js';
import * as sadakatCommand from '../commands/user/sadakat.js';
import * as yayinDurumuCommand from '../commands/user/yayinDurumu.js';
import * as liderlikCommand from '../commands/user/liderlik.js';
import { logger } from '../utils/logger.js';

export async function handleInteraction(interaction: Interaction) {
  try {
    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'ayar') return await ayarCommand.execute(interaction);
      if (commandName === 'hesap-bagla') return await hesapBaglaCommand.execute(interaction);
      if (commandName === 'sadakat' || commandName === 'izlenme-suresi') return await sadakatCommand.execute(interaction);
      if (commandName === 'yayin-durumu') return await yayinDurumuCommand.execute(interaction);
      if (commandName === 'liderlik') return await liderlikCommand.execute(interaction);
    }

    // 2. Select Menus (from /ayar panel)
    if (interaction.isChannelSelectMenu()) {
      const guildId = interaction.guildId;
      if (!guildId) return;

      const selectedChannelId = interaction.values[0];

      if (interaction.customId === 'setup_notif_channel') {
        await prisma.guildConfig.upsert({
          where: { guildId },
          update: { notificationChannelId: selectedChannelId },
          create: { guildId, notificationChannelId: selectedChannelId },
        });

        return interaction.reply({
          content: `✅ Canlı yayın bildirim kanalı <#${selectedChannelId}> olarak güncellendi!`,
          ephemeral: true,
        });
      }

      if (interaction.customId === 'setup_clip_channel') {
        await prisma.guildConfig.upsert({
          where: { guildId },
          update: { clipChannelId: selectedChannelId },
          create: { guildId, clipChannelId: selectedChannelId },
        });

        return interaction.reply({
          content: `✅ Klipler kanalı <#${selectedChannelId}> olarak güncellendi!`,
          ephemeral: true,
        });
      }
    }

    if (interaction.isRoleSelectMenu()) {
      const guildId = interaction.guildId;
      if (!guildId) return;

      const selectedRoleId = interaction.values[0];

      if (interaction.customId === 'setup_sub_role') {
        await prisma.guildConfig.upsert({
          where: { guildId },
          update: { subscriberRoleId: selectedRoleId },
          create: { guildId, subscriberRoleId: selectedRoleId },
        });

        return interaction.reply({
          content: `✅ Kick Abone rolü <@&${selectedRoleId}> olarak ayarlandı! Abone olan kullanıcılara otomatik verilecektir.`,
          ephemeral: true,
        });
      }

      if (interaction.customId === 'setup_vip_role') {
        await prisma.guildConfig.upsert({
          where: { guildId },
          update: { vipRoleId: selectedRoleId },
          create: { guildId, vipRoleId: selectedRoleId },
        });

        return interaction.reply({
          content: `✅ Kick VIP rolü <@&${selectedRoleId}> olarak ayarlandı!`,
          ephemeral: true,
        });
      }

      if (interaction.customId === 'setup_notif_role') {
        await prisma.guildConfig.upsert({
          where: { guildId },
          update: { notificationRoleId: selectedRoleId },
          create: { guildId, notificationRoleId: selectedRoleId },
        });

        return interaction.reply({
          content: `✅ Bildirim rolü <@&${selectedRoleId}> olarak ayarlandı! Artık yayın açıldığında @everyone yerine bu rol etiketlenecek.`,
          ephemeral: true,
        });
      }
    }

    // 3. Buttons (from /ayar panel)
    if (interaction.isButton()) {
      const guildId = interaction.guildId;
      if (!guildId) return;

      if (interaction.customId === 'setup_btn_set_streamer') {
        const modal = new ModalBuilder()
          .setCustomId('modal_set_streamer')
          .setTitle('Kick Yayıncısı Tanımla');

        const input = new TextInputBuilder()
          .setCustomId('input_kick_slug')
          .setLabel('Kick Kanal Kullanıcı Adı (Slug)')
          .setPlaceholder('Örn: elraenn, ferit, wtcn')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'setup_btn_custom_msg') {
        const config = await prisma.guildConfig.findUnique({ where: { guildId } });
        const modal = new ModalBuilder()
          .setCustomId('modal_custom_msg')
          .setTitle('Özel Yayın Duyuru Metni');

        const input = new TextInputBuilder()
          .setCustomId('input_announcement_text')
          .setLabel('Duyuru Metni ({yayinci}, {baslik}, {rol})')
          .setValue(config?.customAnnouncementMessage || '{rol} Yayındayızzz! Koşun!')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'setup_btn_clip_channel') {
        const clipSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('setup_clip_channel')
            .setPlaceholder('🎬 Klipler Kanalını Seçin')
            .setChannelTypes(ChannelType.GuildText)
        );

        return interaction.reply({
          content: 'Otomatik klip paylaşımlarının yapılacağı kanalı seçin:',
          components: [clipSelect],
          ephemeral: true,
        });
      }
    }

    // 4. Modal Submissions
    if (interaction.isModalSubmit()) {
      const guildId = interaction.guildId;
      if (!guildId) return;

      if (interaction.customId === 'modal_set_streamer') {
        const slug = interaction.fields.getTextInputValue('input_kick_slug').trim().toLowerCase();

        await prisma.guildConfig.upsert({
          where: { guildId },
          update: { kickChannelSlug: slug },
          create: { guildId, kickChannelSlug: slug },
        });

        return interaction.reply({
          content: `✅ Bu sunucunun takip edeceği Kick yayıncısı **\`${slug}\`** (https://kick.com/${slug}) olarak ayarlandı!`,
          ephemeral: true,
        });
      }

      if (interaction.customId === 'modal_custom_msg') {
        const text = interaction.fields.getTextInputValue('input_announcement_text').trim();
        await prisma.guildConfig.upsert({
          where: { guildId },
          update: { customAnnouncementMessage: text },
          create: { guildId, customAnnouncementMessage: text },
        });

        return interaction.reply({
          content: `✅ Özel duyuru metni başarıyla kaydedildi:\n>>> ${text}`,
          ephemeral: true,
        });
      }
    }
  } catch (error) {
    logger.error('INTERACTION', 'Etkileşim işlenirken hata meydana geldi:', error);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: 'Bir hata oluştu.', ephemeral: true }).catch(() => null);
    }
  }
}
