import type { Hono } from 'hono'
import type { Config, ProviderConfig, ProviderId } from '../../config/schema.js'
import { normalizeConfig } from '../../config/validation.js'
import type { PanelRuntime } from '../runtime.js'

export function registerConfigRoutes(app: Hono, runtime: PanelRuntime): void {
  app.get('/api/config', c => c.json(maskConfig(runtime.currentConfig())))

  app.put('/api/config', async c => {
    const config = runtime.currentConfig()
    const update = await c.req.json<Partial<Config>>()
    const merged: Config = structuredClone(config)

    if (update.server) {
      const { authToken, ...serverUpdate } = update.server
      Object.assign(merged.server, serverUpdate)
      if (typeof authToken === 'string' && authToken.trim() && !authToken.includes('••••')) {
        merged.server.authToken = authToken
      }
    }
    if (update.providers) {
      for (const [id, pc] of Object.entries(update.providers) as [ProviderId, Partial<ProviderConfig>][]) {
        if (!merged.providers[id]) continue
        Object.assign(merged.providers[id], pc)
        if (pc?.apiKey?.includes('••••')) {
          merged.providers[id].apiKey = config.providers[id].apiKey
        }
      }
    }
    if (update.routing) Object.assign(merged.routing, update.routing)
    if (update.thinking) Object.assign(merged.thinking, update.thinking)
    if (update.webTools) Object.assign(merged.webTools, update.webTools)
    if (update.proxy) Object.assign(merged.proxy, update.proxy)
    if (update.activeProvider) merged.activeProvider = update.activeProvider
    if (update.modelMode) merged.modelMode = update.modelMode

    runtime.saveAndUpdateConfig(normalizeConfig(merged, config))
    return c.json({ ok: true })
  })
}

function maskConfig(config: Config): Config {
  const masked: Config = structuredClone(config)
  masked.server.authToken = ''
  for (const id of Object.keys(masked.providers) as ProviderId[]) {
    const key = masked.providers[id].apiKey ?? ''
    if (key) masked.providers[id].apiKey = `${key.slice(0, 6)}••••••••`
  }
  return masked
}
