import { IQueueService } from './queueInterface.js';
import { MemoryQueueService } from './memoryQueue.js';
import { BullMQQueueService } from './bullmqQueue.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let queueServiceInstance: IQueueService;

if (env.REDIS_URL && env.REDIS_URL.trim().length > 0) {
  logger.info('QUEUE', `Redis bağlantısı tespit edildi (${env.REDIS_URL}), BullMQ motoru kullanılıyor.`);
  queueServiceInstance = new BullMQQueueService(env.REDIS_URL);
} else {
  logger.info('QUEUE', 'REDIS_URL belirtilmedi, hafif Bellek İçi (In-Memory) kuyruk motoru aktif edildi.');
  queueServiceInstance = new MemoryQueueService();
}

export const queueService = queueServiceInstance;
