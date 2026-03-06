export interface HookBus {
  on: (event: string, handler: (...args: unknown[]) => Promise<void> | void) => void
  emit: (event: string, payload?: unknown) => Promise<void>
}

export interface UIExtensionRegistry {
  register: (slot: string, extension: unknown) => void
  list: (slot: string) => unknown[]
}

export interface PosPlugin {
  manifest: {
    name: string
    version: string
    capabilities: string[]
    dependencies?: Array<{ name: string; version: string }>
    conflicts?: string[]
  }
  onInstall?: () => Promise<void>
  onEnable?: () => Promise<void>
  onDisable?: () => Promise<void>
  onConfigChange?: (cfg: unknown) => Promise<void>
  registerRoutes?: (app: unknown) => Promise<void>
  registerHooks?: (bus: HookBus) => Promise<void>
  registerUIExtensions?: (registry: UIExtensionRegistry) => Promise<void>
  healthCheck?: () => Promise<{ ok: boolean; detail?: string }>
}

export class InMemoryUIExtensionRegistry implements UIExtensionRegistry {
  private slots = new Map<string, unknown[]>()

  register(slot: string, extension: unknown) {
    const existing = this.slots.get(slot) || []
    existing.push(extension)
    this.slots.set(slot, existing)
  }

  list(slot: string): unknown[] {
    return this.slots.get(slot) || []
  }
}

export class PluginRegistry {
  private plugins = new Map<string, PosPlugin>()

  register(plugin: PosPlugin) {
    this.plugins.set(plugin.manifest.name, plugin)
  }

  get(name: string): PosPlugin | undefined {
    return this.plugins.get(name)
  }

  list(): PosPlugin[] {
    return [...this.plugins.values()]
  }
}
