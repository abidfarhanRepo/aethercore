"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginRegistry = exports.InMemoryUIExtensionRegistry = void 0;
class InMemoryUIExtensionRegistry {
    constructor() {
        this.slots = new Map();
    }
    register(slot, extension) {
        const existing = this.slots.get(slot) || [];
        existing.push(extension);
        this.slots.set(slot, existing);
    }
    list(slot) {
        return this.slots.get(slot) || [];
    }
}
exports.InMemoryUIExtensionRegistry = InMemoryUIExtensionRegistry;
class PluginRegistry {
    constructor() {
        this.plugins = new Map();
    }
    register(plugin) {
        this.plugins.set(plugin.manifest.name, plugin);
    }
    get(name) {
        return this.plugins.get(name);
    }
    list() {
        return [...this.plugins.values()];
    }
}
exports.PluginRegistry = PluginRegistry;
