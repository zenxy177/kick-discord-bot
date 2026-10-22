import { Client, ActivityType } from 'discord.js';
import { data as ayarData } from '../commands/admin/ayar.js';
import { data as hesapBaglaData } from '../commands/user/hesapBagla.js';
import { data as sadakatData } from '../commands/user/sadakat.js';
import { data as yayinDurumuData } from '../commands/user/yayinDurumu.js';
import { data as liderlikData } from '../commands/user/liderlik.js';
import { MessageUpdater } from '../services/streamTracker/messageUpdater.js';
import { CONSTANTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export async function onReady(client: Client) {
  if (!client.user) return;

  logger.success('DISCORD', `Bot başarıyla Discord'a bağlandı: ${client.user.tag}`);

  // Set bot presence
  client.user.setPresence({
    activities: [
      {
        name: 'Kick Canlı Yayınları 🔴',
        type: ActivityType.Streaming,
        url: 'https://kick.com',
      },
    ],
    status: 'online',
  });

  // Register Slash Commands
  const commands = [
    ayarData.toJSON(),
    hesapBaglaData.toJSON(),
    sadakatData.toJSON(),
    yayinDurumuData.toJSON(),
    liderlikData.toJSON(),
  ];

  try {
    if (client.application) {
      await client.application.commands.set(commands);
      logger.success('DISCORD', `${commands.length} adet Slash Komutu başarıyla kaydedildi (/ayar, /hesap-bagla, /sadakat, /yayin-durumu, /liderlik).`);
    }
  } catch (error) {
    logger.error('DISCORD', 'Slash komutları kaydedilirken hata oluştu:', error);
  }

  // Start periodic live message updater
  const updater = new MessageUpdater(client);
  updater.startPeriodicUpdates(CONSTANTS.DEFAULT_UPDATE_INTERVAL);
}
