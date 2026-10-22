import { queueService } from '../queue/index.js';
import { logger } from '../../utils/logger.js';

export interface KickWebhookPayload {
  event: string;
  data: any;
}

export class KickWebhookHandler {
  async handleWebhook(payload: KickWebhookPayload) {
    const { event, data } = payload;
    logger.info('WEBHOOK', `Kick webhook olayı alındı: ${event}`);

    switch (event) {
      case 'livestream.started':
        await queueService.addJob('kick.stream.start', data);
        break;

      case 'livestream.ended':
        await queueService.addJob('kick.stream.end', data);
        break;

      case 'channel.subscription.new':
      case 'channel.subscription.renewed':
        await queueService.addJob('kick.sub.sync', data);
        break;

      case 'channel.clip.created':
        await queueService.addJob('kick.clip', data);
        break;

      case 'chat.message.sent':
        const sender = data.sender?.username || data.username || data.sender;
        if (sender) {
          await queueService.addJob('kick.chat.message', { sender });
        }
        break;

      default:
        logger.debug('WEBHOOK', `İşlenmeyen webhook olayı: ${event}`);
    }
  }
}

export const kickWebhookHandler = new KickWebhookHandler();
