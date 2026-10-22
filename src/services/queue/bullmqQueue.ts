import { Queue, Worker, QueueEvents } from 'bullmq';
import { IQueueService } from './queueInterface.js';
import { logger } from '../../utils/logger.js';

export class BullMQQueueService implements IQueueService {
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private redisUrl: string;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  private getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const q = new Queue(name, {
        connection: { url: this.redisUrl },
      });
      this.queues.set(name, q);
    }
    return this.queues.get(name)!;
  }

  async addJob<T = any>(name: string, data: T, options?: { delayMs?: number }): Promise<void> {
    const queue = this.getQueue(name);
    await queue.add('default', data, {
      delay: options?.delayMs,
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  processJobs<T = any>(name: string, handler: (data: T) => Promise<void>): void {
    if (!this.workers.has(name)) {
      const worker = new Worker(
        name,
        async (job) => {
          await handler(job.data);
        },
        {
          connection: { url: this.redisUrl },
        }
      );

      worker.on('failed', (job, err) => {
        logger.error('BULLMQ_QUEUE', `İş başarısız [${name} ID: ${job?.id}]:`, err);
      });

      this.workers.set(name, worker);
    }
  }
}
