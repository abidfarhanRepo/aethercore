import Redis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Simple job queue implementation using Redis
 * For production, use Bull/BullMQ package
 * This is a lightweight alternative for async task processing
 */

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  attempts: number;
  maxAttempts: number;
}

export interface QueueOptions {
  name: string;
  concurrency?: number;
  delayMs?: number;
}

export class JobQueue {
  private redis: Redis;
  private name: string;
  private concurrency: number;
  private delayMs: number;
  private handlers: Map<string, Function> = new Map();
  private processing = false;

  constructor(
    options: QueueOptions,
    redisUrl?: string
  ) {
    this.name = options.name;
    this.concurrency = options.concurrency || 5;
    this.delayMs = options.delayMs || 0;

    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });

    this.redis.on('error', (err) => {
      logger.error(`Queue ${this.name} Redis error:`, err);
    });
  }

  /**
   * Register job handler
   */
  on(jobType: string, handler: (job: Job) => Promise<void>) {
    this.handlers.set(jobType, handler);
  }

  /**
   * Add job to queue
   */
  async add<T>(jobType: string, data: T, maxAttempts: number = 3): Promise<string> {
    const jobId = `${this.name}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

    const job: Job = {
      id: jobId,
      type: jobType,
      data,
      status: 'pending',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts,
    };

    try {
      await this.redis.lpush(`${this.name}:queue`, JSON.stringify(job));
      logger.debug(`Job added to queue: ${jobId}`);
      return jobId;
    } catch (error) {
      logger.error('Error adding job to queue:', error);
      throw error;
    }
  }

  /**
   * Process jobs from queue
   */
  async process() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    logger.info(`Starting queue processor: ${this.name} (concurrency: ${this.concurrency})`);

    while (this.processing) {
      try {
        // Process multiple jobs concurrently
        const jobs: Promise<void>[] = [];

        for (let i = 0; i < this.concurrency; i++) {
          jobs.push(this.processNextJob());
        }

        await Promise.all(jobs);

        // Delay before next batch
        if (this.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        }
      } catch (error) {
        logger.error('Error in queue processor:', error);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retry
      }
    }
  }

  /**
   * Process single job
   */
  private async processNextJob(): Promise<void> {
    try {
      const jobString = await this.redis.rpop(`${this.name}:queue`);

      if (!jobString) {
        // Queue is empty, wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));
        return;
      }

      const job: Job = JSON.parse(jobString);
      const handler = this.handlers.get(job.type);

      if (!handler) {
        logger.warn(`No handler for job type: ${job.type}`);
        return;
      }

      job.status = 'processing';
      job.startedAt = Date.now();
      job.attempts++;

      try {
        // Save processing state
        await this.redis.set(`${this.name}:job:${job.id}`, JSON.stringify(job), 'EX', 3600);

        // Execute handler
        await handler(job);

        job.status = 'completed';
        job.completedAt = Date.now();

        // Save completed job for a while (audit trail)
        await this.redis.set(`${this.name}:job:${job.id}`, JSON.stringify(job), 'EX', 86400);

        logger.info(
          `Job completed: ${job.id} (${job.type}) in ${job.completedAt - job.startedAt}ms`
        );
      } catch (error) {
        logger.error(`Job failed: ${job.id} (${job.type})`, error);

        job.error = error instanceof Error ? error.message : String(error);

        if (job.attempts < job.maxAttempts) {
          // Re-queue job for retry
          job.status = 'pending';
          await this.redis.lpush(`${this.name}:queue`, JSON.stringify(job));
          logger.info(`Job re-queued for retry: ${job.id} (attempt ${job.attempts})`);
        } else {
          job.status = 'failed';
          job.completedAt = Date.now();

          // Save failed job
          await this.redis.set(`${this.name}:job:${job.id}`, JSON.stringify(job), 'EX', 604800); // 1 week
          logger.error(`Job permanently failed: ${job.id} (${job.type})`);
        }
      }
    } catch (error) {
      logger.error('Error processing job:', error);
    }
  }

  /**
   * Get job status
   */
  async getJob(jobId: string): Promise<Job | null> {
    try {
      const jobString = await this.redis.get(`${this.name}:job:${jobId}`);
      return jobString ? JSON.parse(jobString) : null;
    } catch (error) {
      logger.error('Error getting job:', error);
      return null;
    }
  }

  /**
   * Get queue length
   */
  async getQueueLength(): Promise<number> {
    try {
      return await this.redis.llen(`${this.name}:queue`);
    } catch (error) {
      logger.error('Error getting queue length:', error);
      return 0;
    }
  }

  /**
   * Clear queue
   */
  async clear(): Promise<void> {
    try {
      await this.redis.del(`${this.name}:queue`);
      logger.info(`Queue cleared: ${this.name}`);
    } catch (error) {
      logger.error('Error clearing queue:', error);
    }
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    this.processing = false;
    logger.info(`Stopped queue processor: ${this.name}`);
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.stop();
    await this.redis.quit();
  }
}

/**
 * Queue instances for different job types
 */
export const reportQueue = new JobQueue({ name: 'report-queue', concurrency: 2 });
export const emailQueue = new JobQueue({ name: 'email-queue', concurrency: 5 });
export const syncQueue = new JobQueue({ name: 'sync-queue', concurrency: 3 });
export const analyticsQueue = new JobQueue({ name: 'analytics-queue', concurrency: 2 });

/**
 * Initialize all queues
 */
export async function initializeQueues() {
  logger.info('Initializing job queues...');

  // Register handlers
  reportQueue.on('generate-report', async (job) => {
    logger.info(`Generating report: ${job.data.type}`);
    // Generate report logic here
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate async work
  });

  emailQueue.on('send-email', async (job) => {
    logger.info(`Sending email to: ${job.data.to}`);
    // Send email logic here
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  syncQueue.on('sync-inventory', async (job) => {
    logger.info(`Syncing inventory from: ${job.data.source}`);
    // Sync logic here
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  // Start processing
  reportQueue.process();
  emailQueue.process();
  syncQueue.process();
  analyticsQueue.process();

  logger.info('Job queues initialized');
}
