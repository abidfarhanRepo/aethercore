type HookHandler = (payload?: unknown) => Promise<void> | void

export const CORE_HOOKS = [
  'beforeSaleFinalize',
  'afterSaleFinalize',
  'beforeInventoryCommit',
  'afterInventoryCommit',
  'beforeRefund',
  'afterRefund',
  'onSyncConflict',
  'onReceiptRender',
] as const

export type CoreHookName = (typeof CORE_HOOKS)[number]

export class HookBus {
  private listeners = new Map<string, HookHandler[]>()

  on(event: string, handler: HookHandler) {
    const handlers = this.listeners.get(event) || []
    handlers.push(handler)
    this.listeners.set(event, handlers)
  }

  async emit(event: string, payload?: unknown) {
    const handlers = this.listeners.get(event) || []
    for (const handler of handlers) {
      await handler(payload)
    }
  }

  has(event: string): boolean {
    return (this.listeners.get(event) || []).length > 0
  }
}

export const coreHookBus = new HookBus()
