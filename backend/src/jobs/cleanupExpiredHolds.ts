import cron, { ScheduledTask } from 'node-cron'
import { cleanupExpiredInventoryHolds } from '../lib/inventoryHold'
import { logger } from '../utils/logger'

let holdCleanupTask: ScheduledTask | null = null

export function startExpiredHoldCleanupJob(): ScheduledTask {
  if (holdCleanupTask) {
    return holdCleanupTask
  }

  holdCleanupTask = cron.schedule('*/1 * * * *', async () => {
    try {
      const deletedCount = await cleanupExpiredInventoryHolds()
      if (deletedCount > 0) {
        logger.info({ deletedCount }, 'Expired inventory holds cleaned up')
      }
    } catch (error) {
      logger.error({ error }, 'Failed to clean up expired inventory holds')
    }
  })

  return holdCleanupTask
}

export function stopExpiredHoldCleanupJob(): void {
  if (!holdCleanupTask) {
    return
  }

  holdCleanupTask.stop()
  holdCleanupTask.destroy()
  holdCleanupTask = null
}
