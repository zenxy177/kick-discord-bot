export interface IQueueService {
  addJob<T = any>(name: string, data: T, options?: { delayMs?: number }): Promise<void>;
  processJobs<T = any>(name: string, handler: (data: T) => Promise<void>): void;
}
