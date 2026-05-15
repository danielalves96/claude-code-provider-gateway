import { loadConfig } from './config/index.js'
import { configureOutboundNetwork } from './runtime/network.js'
import { startDaemon } from './runtime/daemon.js'

const config = loadConfig()
configureOutboundNetwork(config.proxy.enabled ? config.proxy.url : undefined)
startDaemon(config)
