"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startExpiredHoldCleanupJob = startExpiredHoldCleanupJob;
exports.stopExpiredHoldCleanupJob = stopExpiredHoldCleanupJob;
const node_cron_1 = __importDefault(require("node-cron"));
const inventoryHold_1 = require("../lib/inventoryHold");
const logger_1 = require("../utils/logger");
let holdCleanupTask = null;
function startExpiredHoldCleanupJob() {
    if (holdCleanupTask) {
        return holdCleanupTask;
    }
    holdCleanupTask = node_cron_1.default.schedule('*/1 * * * *', async () => {
        try {
            const deletedCount = await (0, inventoryHold_1.cleanupExpiredInventoryHolds)();
            if (deletedCount > 0) {
                logger_1.logger.info({ deletedCount }, 'Expired inventory holds cleaned up');
            }
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Failed to clean up expired inventory holds');
        }
    });
    return holdCleanupTask;
}
function stopExpiredHoldCleanupJob() {
    if (!holdCleanupTask) {
        return;
    }
    holdCleanupTask.stop();
    holdCleanupTask.destroy();
    holdCleanupTask = null;
}
