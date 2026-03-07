"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreHookBus = exports.HookBus = exports.CORE_HOOKS = void 0;
exports.CORE_HOOKS = [
    'beforeSaleFinalize',
    'afterSaleFinalize',
    'beforeInventoryCommit',
    'afterInventoryCommit',
    'beforeRefund',
    'afterRefund',
    'onSyncConflict',
    'onReceiptRender',
];
class HookBus {
    constructor() {
        this.listeners = new Map();
    }
    on(event, handler) {
        const handlers = this.listeners.get(event) || [];
        handlers.push(handler);
        this.listeners.set(event, handlers);
    }
    async emit(event, payload) {
        const handlers = this.listeners.get(event) || [];
        for (const handler of handlers) {
            await handler(payload);
        }
    }
    has(event) {
        return (this.listeners.get(event) || []).length > 0;
    }
}
exports.HookBus = HookBus;
exports.coreHookBus = new HookBus();
