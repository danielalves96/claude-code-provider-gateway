import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeLocalNoProxy, resolveOutboundProxyConfig } from './network.js'

test('resolveOutboundProxyConfig maps HTTPS proxy env and protects local hosts', () => {
  const config = resolveOutboundProxyConfig({
    HTTPS_PROXY: 'http://127.0.0.1:7890',
  } as NodeJS.ProcessEnv)

  assert.deepEqual(config, {
    httpProxy: undefined,
    httpsProxy: 'http://127.0.0.1:7890',
    noProxy: 'localhost,127.0.0.1,::1',
  })
})

test('resolveOutboundProxyConfig uses ALL_PROXY as fallback for both schemes', () => {
  const config = resolveOutboundProxyConfig({
    ALL_PROXY: 'http://127.0.0.1:7890',
  } as NodeJS.ProcessEnv)

  assert.deepEqual(config, {
    httpProxy: 'http://127.0.0.1:7890',
    httpsProxy: 'http://127.0.0.1:7890',
    noProxy: 'localhost,127.0.0.1,::1',
  })
})

test('resolveOutboundProxyConfig returns null when no proxy env is set', () => {
  assert.equal(resolveOutboundProxyConfig({} as NodeJS.ProcessEnv), null)
})

test('mergeLocalNoProxy preserves existing entries and appends missing local hosts', () => {
  assert.equal(mergeLocalNoProxy('example.com, localhost'), 'example.com,localhost,127.0.0.1,::1')
})
