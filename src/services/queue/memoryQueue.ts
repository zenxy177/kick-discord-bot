import { IQueueService } from './queueInterface.js';
import { logger } from '../../utils/logger.js';

export class MemoryQueueService implements IQueueService {
  private handlers = new Map<string, Array<(data: any) => Promise<void>>>();

  async addJob<T = any>(name: string, data: T, options?: { delayMs?: number }): Promise<void> {
    const execute = async () => {
      const handlers = this.handlers.get(name) || [];
      for (const handler of handlers) {
        try {
          await handler(data);
        } catch (error) {
          logger.error('MEMORY_QUEUE', `İş yürütülürken hata oluştu [${name}]:`, error);
        }
      }
    };

    if (options?.delayMs && options.delayMs > 0) {
      setTimeout(execute, options.delayMs);
    } else {
      setImmediate(execute);
    }
  }

  processJobs<T = any>(name: string, handler: (data: T) => Promise<void>): void {
    if (!this.handlers.has(name)) {
      this.handlers.set(name, []);
    }
    this.handlers.get(name)!.push(handler);
  }
}
