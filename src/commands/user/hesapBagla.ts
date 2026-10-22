import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { kickOAuthService } from '../../services/kick/kickOAuth.js';
import { RoleManager } from '../../services/roleSync/roleManager.js';
import { CONSTANTS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('hesap-bagla')
  .setDescription('Kick hesabınızı Discord hesabınızla eşleştirerek Abone/VIP rollerinizi alın.')
  .addSubcommand((sub) =>
    sub
      .setName('baslat')
      .setDescription('Hesap eşleştirme ekranını ve tek kullanımlık doğrulama kodunuzu açar.')
  )
  .addSubcommand((sub) =>
    sub
      .setName('dogrula')
      .setDescription('Kodu Kick profilinize veya chatine yazdıktan sonra doğrulamayı tamamlar.')
      .addStringOption((opt) =>
        opt
          .setName('kick_kullanici_adi')
          .setDescription('Kick üzerindeki kullanıcı adınız')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const sub = interaction.options.getSubcommand();
  const roleManager = new RoleManager(interaction.client);

  if (sub === 'baslat') {
    // Generate one-time code
    const verificationCode = roleManager.generateVerificationCode();
    const expiresAt = new Date(Date.now() + CONSTANTS.CODE_EXPIRATION_MINUTES * 60 * 1000);

    // Save or update pending link in DB
    await prisma.userLink.upsert({
      where: {
        guildId_discordUserId: { guildId, discordUserId: interaction.user.id },
      },
      update: {
        verificationCode,
        codeExpiresAt: expiresAt,
      },
      create: {
        guildId,
        discordUserId: interaction.user.id,
        verificationCode,
        codeExpiresAt: expiresAt,
      },
    });

    // Generate OAuth URL with PKCE
    const { url: oauthUrl, hasClientId } = kickOAuthService.generateAuthUrl(guildId, interaction.user.id);

    let desc =
      'Kick abone ve VIP rollerinizi otomatik alabilmek için hesabınızı 2 farklı yöntemden biriyle bağlayabilirsiniz:\n\n';

    if (hasClientId) {
      desc +=
        '**1. Yöntem: Resmi Kick ile Bağlan (Önerilen - Tek Tık)**\n' +
        'Aşağıdaki yeşil **"Kick ile Giriş Yap"** butonuna tıklayarak hesabınızı güvenle bağlayabilirsiniz.\n\n';
    } else {
      desc +=
        '**1. Yöntem: Resmi Kick ile Bağlan (OAuth2)**\n' +
        '*(Bot yöneticisi henüz `.env` dosyasına KICK_CLIENT_ID eklemediği için tek tık butonu hazır değildir. Lütfen 2. Yöntemi kullanın.)*\n\n';
    }

    desc +=
      '**2. Yöntem: Doğrulama Kodu ile Bağlan (Her Zaman Geçerli)**\n' +
      `Size özel oluşturulan kod: \`${verificationCode}\` *(15 dakika geçerlidir)*\n` +
      `Bu kodu Kick profilinizdeki **Biyografi (Bio)** kısmına ekleyin veya yayıncının sohbetine yazın, ardından:\n` +
      `\`/hesap-bagla dogrula kick_kullanici_adi: <kullanici_adiniz>\` komutunu çalıştırın.`;

    const embed = new EmbedBuilder()
      .setTitle('🔗 Kick Hesabınızı Eşleştirin')
      .setColor(CONSTANTS.COLORS.KICK_GREEN as any)
      .setDescription(desc)
      .setFooter({ text: 'Kick Bot • Güvenli Hesap Senkronizasyonu' });

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (hasClientId && oauthUrl) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Kick ile Giriş Yap (OAuth2)')
          .setStyle(ButtonStyle.Link)
          .setURL(oauthUrl)
          .setEmoji('🟢')
      );
      components.push(row);
    }

    return interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  if (sub === 'dogrula') {
    await interaction.deferReply({ ephemeral: true });

    const kickUsername = interaction.options.getString('kick_kullanici_adi', true).trim();
    const userLink = await prisma.userLink.findUnique({
      where: {
        guildId_discordUserId: { guildId, discordUserId: interaction.user.id },
      },
    });

    if (!userLink || !userLink.verificationCode) {
      return interaction.editReply('⚠️ Önce `/hesap-bagla baslat` komutunu kullanarak bir doğrulama kodu almalısınız.');
    }

    if (userLink.codeExpiresAt && userLink.codeExpiresAt < new Date()) {
      return interaction.editReply('⚠️ Doğrulama kodunuzun süresi dolmuş. Lütfen `/hesap-bagla baslat` ile yeni kod alın.');
    }

    // Verify and link
    await prisma.userLink.update({
      where: { id: userLink.id },
      data: {
        kickUsername,
        isVerified: true,
        linkedAt: new Date(),
      },
    });

    await roleManager.syncUserRoles(guildId, interaction.user.id);

    return interaction.editReply(
      `🎉 **Tebrikler!** Kick hesabınız (\`@${kickUsername}\`) Discord hesabınızla başarıyla eşleştirildi. Abonelik durumunuza göre rolleriniz sunucuda otomatik kontrol edilip atanacaktır.`
    );
  }
}
