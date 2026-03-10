"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsQueue = exports.syncQueue = exports.emailQueue = exports.reportQueue = exports.JobQueue = void 0;
exports.initializeQueues = initializeQueues;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
class JobQueue {
    constructor(options, redisUrl) {
        this.handlers = new Map();
        this.processing = false;
        this.name = options.name;
        this.concurrency = options.concurrency || 5;
        this.delayMs = options.delayMs || 0;
        this.redis = new ioredis_1.default(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
            retryStrategy: () => null,
            enableOfflineQueue: false,
        });
        this.redis.on('error', (err) => {
            logger_1.logger.error(`Queue ${this.name} Redis error:`, err);
        });
    }
    /**
     * Register job handler
     */
    on(jobType, handler) {
        this.handlers.set(jobType, handler);
    }
    /**
     * Add job to queue
     */
    async add(jobType, data, maxAttempts = 3) {
        const jobId = `${this.name}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
        const job = {
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
            logger_1.logger.debug(`Job added to queue: ${jobId}`);
            return jobId;
        }
        catch (error) {
            logger_1.logger.error('Error adding job to queue:', error);
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
        logger_1.logger.info(`Starting queue processor: ${this.name} (concurrency: ${this.concurrency})`);
        while (this.processing) {
            try {
                // Process multiple jobs concurrently
                const jobs = [];
                for (let i = 0; i < this.concurrency; i++) {
                    jobs.push(this.processNextJob());
                }
                await Promise.all(jobs);
                // Delay before next batch
                if (this.delayMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
                }
            }
            catch (error) {
                logger_1.logger.error('Error in queue processor:', error);
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retry
            }
        }
    }
    /**
     * Process single job
     */
    async processNextJob() {
        try {
            const jobString = await this.redis.rpop(`${this.name}:queue`);
            if (!jobString) {
                // Queue is empty, wait a bit
                await new Promise((resolve) => setTimeout(resolve, 100));
                return;
            }
            const job = JSON.parse(jobString);
            const handler = this.handlers.get(job.type);
            if (!handler) {
                logger_1.logger.warn(`No handler for job type: ${job.type}`);
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
                logger_1.logger.info(`Job completed: ${job.id} (${job.type}) in ${job.completedAt - job.startedAt}ms`);
            }
            catch (error) {
                logger_1.logger.error(`Job failed: ${job.id} (${job.type})`, error);
                job.error = error instanceof Error ? error.message : String(error);
                if (job.attempts < job.maxAttempts) {
                    // Re-queue job for retry
                    job.status = 'pending';
                    await this.redis.lpush(`${this.name}:queue`, JSON.stringify(job));
                    logger_1.logger.info(`Job re-queued for retry: ${job.id} (attempt ${job.attempts})`);
                }
                else {
                    job.status = 'failed';
                    job.completedAt = Date.now();
                    // Save failed job
                    await this.redis.set(`${this.name}:job:${job.id}`, JSON.stringify(job), 'EX', 604800); // 1 week
                    logger_1.logger.error(`Job permanently failed: ${job.id} (${job.type})`);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error processing job:', error);
        }
    }
    /**
     * Get job status
     */
    async getJob(jobId) {
        try {
            const jobString = await this.redis.get(`${this.name}:job:${jobId}`);
            return jobString ? JSON.parse(jobString) : null;
        }
        catch (error) {
            logger_1.logger.error('Error getting job:', error);
            return null;
        }
    }
    /**
     * Get queue length
     */
    async getQueueLength() {
        try {
            return await this.redis.llen(`${this.name}:queue`);
        }
        catch (error) {
            logger_1.logger.error('Error getting queue length:', error);
            return 0;
        }
    }
    /**
     * Clear queue
     */
    async clear() {
        try {
            await this.redis.del(`${this.name}:queue`);
            logger_1.logger.info(`Queue cleared: ${this.name}`);
        }
        catch (error) {
            logger_1.logger.error('Error clearing queue:', error);
        }
    }
    /**
     * Stop processing
     */
    async stop() {
        this.processing = false;
        logger_1.logger.info(`Stopped queue processor: ${this.name}`);
    }
    /**
     * Close Redis connection
     */
    async close() {
        await this.stop();
        await this.redis.quit();
    }
}
exports.JobQueue = JobQueue;
/**
 * Queue instances for different job types
 */
exports.reportQueue = new JobQueue({ name: 'report-queue', concurrency: 2 });
exports.emailQueue = new JobQueue({ name: 'email-queue', concurrency: 5 });
exports.syncQueue = new JobQueue({ name: 'sync-queue', concurrency: 3 });
exports.analyticsQueue = new JobQueue({ name: 'analytics-queue', concurrency: 2 });
/**
 * Initialize all queues
 */
async function initializeQueues() {
    logger_1.logger.info('Initializing job queues...');
    // Register handlers
    exports.reportQueue.on('generate-report', async (job) => {
        logger_1.logger.info(`Generating report: ${job.data.type}`);
        // Generate report logic here
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate async work
    });
    exports.emailQueue.on('send-email', async (job) => {
        logger_1.logger.info(`Sending email to: ${job.data.to}`);
        // Send email logic here
        await new Promise((resolve) => setTimeout(resolve, 500));
    });
    exports.syncQueue.on('sync-inventory', async (job) => {
        logger_1.logger.info(`Syncing inventory from: ${job.data.source}`);
        // Sync logic here
        await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    // Start processing
    exports.reportQueue.process();
    exports.emailQueue.process();
    exports.syncQueue.process();
    exports.analyticsQueue.process();
    logger_1.logger.info('Job queues initialized');
}
