import test from 'node:test'
import assert from 'node:assert/strict'
import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'
import { configureOutboundNetwork, mergeLocalNoProxy } from './network.js'

test('configureOutboundNetwork applies proxy URL and sets NO_PROXY for local hosts', () => {
  const originalFetch = globalThis.fetch
  const originalDispatcher = getGlobalDispatcher()
  const originalNoProxy = process.env.NO_PROXY
  const originalNoProxyLower = process.env.no_proxy

  try {
    const applied = configureOutboundNetwork('http://127.0.0.1:7890')
    assert.equal(applied, true)
    assert.equal(process.env.NO_PROXY, 'localhost,127.0.0.1,::1')
  } finally {
    if (originalNoProxy === undefined) delete process.env.NO_PROXY
    else process.env.NO_PROXY = originalNoProxy
    if (originalNoProxyLower === undefined) delete process.env.no_proxy
    else process.env.no_proxy = originalNoProxyLower
    globalThis.fetch = originalFetch
    setGlobalDispatcher(originalDispatcher)
  }
})

test('configureOutboundNetwork returns false and has no side effects when URL is undefined', () => {
  const originalFetch = globalThis.fetch
  const applied = configureOutboundNetwork(undefined)
  assert.equal(applied, false)
  assert.equal(globalThis.fetch, originalFetch)
})

test('configureOutboundNetwork returns false and has no side effects when URL is empty string', () => {
  const originalFetch = globalThis.fetch
  const applied = configureOutboundNetwork('')
  assert.equal(applied, false)
  assert.equal(globalThis.fetch, originalFetch)
})

test('mergeLocalNoProxy preserves existing entries and appends missing local hosts', () => {
  assert.equal(mergeLocalNoProxy('example.com, localhost'), 'example.com,localhost,127.0.0.1,::1')
})

test('mergeLocalNoProxy with undefined returns only local hosts', () => {
  assert.equal(mergeLocalNoProxy(undefined), 'localhost,127.0.0.1,::1')
})
