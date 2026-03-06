import { CORE_HOOKS, HookBus } from '../../src/lib/hookBus'

describe('hookBus', () => {
  it('exposes all required core hooks', () => {
    expect(CORE_HOOKS).toEqual([
      'beforeSaleFinalize',
      'afterSaleFinalize',
      'beforeInventoryCommit',
      'afterInventoryCommit',
      'beforeRefund',
      'afterRefund',
      'onSyncConflict',
      'onReceiptRender',
    ])
  })

  it('runs handlers in registration order', async () => {
    const bus = new HookBus()
    const calls: string[] = []

    bus.on('beforeSaleFinalize', () => calls.push('a'))
    bus.on('beforeSaleFinalize', () => calls.push('b'))

    await bus.emit('beforeSaleFinalize', { saleId: 'sale-1' })

    expect(calls).toEqual(['a', 'b'])
  })
})
