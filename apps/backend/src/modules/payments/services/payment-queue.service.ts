import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface QueueJob<T = unknown> {
  id: string;
  type: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  delay: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

@Injectable()
export class PaymentQueueService {
  private readonly logger = new Logger(PaymentQueueService.name);
  private readonly store = new Map<string, QueueJob>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  add<T>(
    type: string,
    data: T,
    options?: { delay?: number; maxAttempts?: number; jobId?: string },
  ): QueueJob {
    const id = options?.jobId || `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const job: QueueJob = {
      id,
      type,
      data: data as any,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      delay: options?.delay ?? 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.set(id, job);
    this.eventEmitter.emit(`queue.${type}.added`, job);

    if (options?.delay) {
      const timer = setTimeout(() => this.process(job), options.delay);
      this.timers.set(id, timer);
    } else {
      this.process(job);
    }

    return job;
  }

  private async process(job: QueueJob): Promise<void> {
    job.status = 'processing';
    job.attempts++;
    job.updatedAt = new Date();
    this.eventEmitter.emit(`queue.${job.type}.processing`, job);

    try {
      const handler = this.getHandler(job.type);
      if (!handler) throw new Error(`No handler registered for job type: ${job.type}`);

      await handler(job);
      job.status = 'completed';
      job.updatedAt = new Date();
      this.eventEmitter.emit(`queue.${job.type}.completed`, job);
      this.logger.log(`Job completed: ${job.id} (${job.type})`);
    } catch (err) {
      job.error = err.message;
      job.updatedAt = new Date();

      if (job.attempts < job.maxAttempts) {
        job.status = 'pending';
        const backoff = Math.min(1000 * Math.pow(2, job.attempts), 60000);
        this.logger.warn(`Job retry ${job.attempts}/${job.maxAttempts}: ${job.id} in ${backoff}ms`);
        const timer = setTimeout(() => this.process(job), backoff);
        this.timers.set(job.id, timer);
      } else {
        job.status = 'failed';
        this.eventEmitter.emit(`queue.${job.type}.failed`, job);
        this.logger.error(`Job failed permanently: ${job.id} (${job.type}) — ${err.message}`);
      }
    }
  }

  private handlers = new Map<string, (job: QueueJob) => Promise<void>>();

  registerHandler(type: string, handler: (job: QueueJob) => Promise<void>): void {
    this.handlers.set(type, handler);
    this.logger.log(`Handler registered for job type: ${type}`);
  }

  private getHandler(type: string): ((job: QueueJob) => Promise<void>) | undefined {
    return this.handlers.get(type);
  }

  getJob(id: string): QueueJob | undefined {
    return this.store.get(id);
  }

  getJobsByType(type: string, status?: QueueJob['status']): QueueJob[] {
    const jobs: QueueJob[] = [];
    for (const job of this.store.values()) {
      if (job.type === type && (!status || job.status === status)) jobs.push(job);
    }
    return jobs;
  }

  getStats(): { total: number; pending: number; processing: number; completed: number; failed: number } {
    const stats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const job of this.store.values()) {
      stats.total++;
      stats[job.status]++;
    }
    return stats;
  }

  async onModuleDestroy() {
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.logger.log(`Cleared ${this.timers.size} pending job timers`);
  }
}
