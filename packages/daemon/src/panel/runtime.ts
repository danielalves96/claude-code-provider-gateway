import { createServer, type RequestListener, type Server } from 'node:http'
import { saveConfig } from '../config/index.js'
import type { Config } from '../config/schema.js'
import { ProviderRegistry } from '../proxy/providers/registry.js'

export type OAuthFlow = {
  verifier: string
  status: 'pending' | 'success' | 'error'
  error?: string
  server?: Server
  timer?: NodeJS.Timeout
}

export type CopilotFlow = {
  deviceCode: string
  userCode: string
  verificationUri: string
  interval: number
  expiresAt: number
  status: 'pending' | 'success' | 'error'
  error?: string
  poller?: NodeJS.Timeout
}

export class PanelRuntime {
  private config: Config
  readonly registry: ProviderRegistry
  readonly oauthFlows = new Map<string, OAuthFlow>()
  readonly copilotFlows = new Map<string, CopilotFlow>()

  constructor(
    initialConfig: Config,
    private readonly persistConfig: (config: Config) => void = saveConfig,
  ) {
    this.config = initialConfig
    this.registry = new ProviderRegistry(initialConfig)
  }

  currentConfig(): Config {
    return this.config
  }

  updateConfig(config: Config): void {
    this.config = config
    this.registry.updateConfig(config)
  }

  saveAndUpdateConfig(config: Config): void {
    this.persistConfig(config)
    this.updateConfig(config)
  }

  createCallbackServer(handler: RequestListener): Server {
    return createServer(handler)
  }
}
