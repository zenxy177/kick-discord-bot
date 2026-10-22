import { Client } from 'discord.js';
import { prisma } from '../../database/client.js';
import { logger } from '../../utils/logger.js';

export class RoleManager {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Syncs subscriber and VIP roles for a specific user in a guild
   */
  async syncUserRoles(guildId: string, discordUserId: string) {
    try {
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId },
      });

      if (!guildConfig) return;

      const userLink = await prisma.userLink.findUnique({
        where: {
          guildId_discordUserId: { guildId, discordUserId },
        },
      });

      if (!userLink || !userLink.isVerified) return;

      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;

      const member = await guild.members.fetch(discordUserId).catch(() => null);
      if (!member) return;

      // Botun yetkisini kontrol et
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember || !botMember.permissions.has('ManageRoles')) {
        logger.warn('ROLE_SYNC', `Botun '${guild.name}' sunucusunda 'Rolleri Yönet' (Manage Roles) yetkisi yok!`);
        return;
      }

      // 1. Subscriber Role
      if (guildConfig.subscriberRoleId) {
        const subRole = await guild.roles.fetch(guildConfig.subscriberRoleId).catch(() => null);
        if (subRole) {
          if (!subRole.editable) {
            logger.warn(
              'ROLE_SYNC',
              `⚠️ '${subRole.name}' rolü botun rolünden daha üstte! Lütfen Discord Sunucu Ayarları > Roller kısmında botun rolünü '${subRole.name}' rolünün üzerine taşıyın.`
            );
          } else {
            const hasRole = member.roles.cache.has(subRole.id);
            if (userLink.isSubscribed && !hasRole) {
              await member.roles.add(subRole, 'Kick Abone Rolü Otomatik Eklendi');
              logger.success('ROLE_SYNC', `Abone rolü verildi -> ${member.user.tag} (${guild.name})`);
            } else if (!userLink.isSubscribed && hasRole) {
              await member.roles.remove(subRole, 'Kick Aboneliği Sona Erdi');
              logger.info('ROLE_SYNC', `Abone rolü alındı -> ${member.user.tag} (${guild.name})`);
            }
          }
        }
      }

      // 2. VIP Role
      if (guildConfig.vipRoleId) {
        const vipRole = await guild.roles.fetch(guildConfig.vipRoleId).catch(() => null);
        if (vipRole) {
          if (!vipRole.editable) {
            logger.warn(
              'ROLE_SYNC',
              `⚠️ '${vipRole.name}' rolü botun rolünden daha üstte! Lütfen Discord Sunucu Ayarları > Roller kısmında botun rolünü '${vipRole.name}' rolünün üzerine taşıyın.`
            );
          } else {
            const hasVipRole = member.roles.cache.has(vipRole.id);
            if (userLink.isVip && !hasVipRole) {
              await member.roles.add(vipRole, 'Kick VIP Rolü Otomatik Eklendi');
              logger.success('ROLE_SYNC', `VIP rolü verildi -> ${member.user.tag} (${guild.name})`);
            } else if (!userLink.isVip && hasVipRole) {
              await member.roles.remove(vipRole, 'Kick VIP Statüsü Sona Erdi');
              logger.info('ROLE_SYNC', `VIP rolü alındı -> ${member.user.tag} (${guild.name})`);
            }
          }
        }
      }
    } catch (error) {
      logger.error('ROLE_SYNC', `Rol senkronizasyonunda hata oluştu (${discordUserId}):`, error);
    }
  }

  /**
   * Generates a unique verification code: "KICK-8492"
   */
  generateVerificationCode(): string {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `KICK-${randomDigits}`;
  }
}
