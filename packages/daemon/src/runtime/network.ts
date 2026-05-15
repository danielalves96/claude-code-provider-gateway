import { EnvHttpProxyAgent, fetch as undiciFetch, setGlobalDispatcher } from 'undici'

const LOCAL_NO_PROXY_HOSTS = ['localhost', '127.0.0.1', '::1']

export function configureOutboundNetwork(proxyUrl?: string): boolean {
  if (!proxyUrl) return false

  const noProxy = mergeLocalNoProxy(process.env.NO_PROXY ?? process.env.no_proxy)
  process.env.NO_PROXY = noProxy
  process.env.no_proxy = noProxy

  setGlobalDispatcher(new EnvHttpProxyAgent({ httpProxy: proxyUrl, httpsProxy: proxyUrl, noProxy }))
  globalThis.fetch = undiciFetch as unknown as typeof globalThis.fetch
  return true
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
