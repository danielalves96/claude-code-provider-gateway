import { EnvHttpProxyAgent, fetch as undiciFetch, setGlobalDispatcher } from 'undici'

const LOCAL_NO_PROXY_HOSTS = ['localhost', '127.0.0.1', '::1']

export interface OutboundProxyConfig {
  httpProxy?: string
  httpsProxy?: string
  noProxy: string
}

export function configureOutboundNetwork(env: NodeJS.ProcessEnv = process.env): boolean {
  const proxyConfig = resolveOutboundProxyConfig(env)
  if (!proxyConfig) return false

  env.NO_PROXY = proxyConfig.noProxy
  env.no_proxy = proxyConfig.noProxy
  process.env.NO_PROXY = proxyConfig.noProxy
  process.env.no_proxy = proxyConfig.noProxy

  setGlobalDispatcher(new EnvHttpProxyAgent(proxyConfig))
  globalThis.fetch = undiciFetch as unknown as typeof globalThis.fetch
  return true
}

export function resolveOutboundProxyConfig(env: NodeJS.ProcessEnv): OutboundProxyConfig | null {
  const fallbackProxy = env.ALL_PROXY ?? env.all_proxy
  const httpProxy = env.HTTP_PROXY ?? env.http_proxy ?? fallbackProxy
  const httpsProxy = env.HTTPS_PROXY ?? env.https_proxy ?? fallbackProxy

  if (!httpProxy && !httpsProxy) return null

  return {
    httpProxy,
    httpsProxy,
    noProxy: mergeLocalNoProxy(env.NO_PROXY ?? env.no_proxy),
  }
}

export function mergeLocalNoProxy(value: string | undefined): string {
  const entries = (value ?? '')
    .split(/[,\s]+/)
    .map(entry => entry.trim())
    .filter(Boolean)

  const seen = new Set(entries.map(entry => entry.toLowerCase()))
  for (const host of LOCAL_NO_PROXY_HOSTS) {
    if (!seen.has(host.toLowerCase())) entries.push(host)
  }

  return entries.join(',')
}
