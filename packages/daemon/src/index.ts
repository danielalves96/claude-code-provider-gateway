import { loadConfig } from './config/index.js'
import { configureOutboundNetwork } from './runtime/network.js'
import { startDaemon } from './runtime/daemon.js'

configureOutboundNetwork()
const config = loadConfig()
startDaemon(config)
