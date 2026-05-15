import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDefaultConfig } from '../config/index.js'
import { createPanelApp } from './app.js'

test('panel API rejects browser requests from untrusted origins', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const response = await app.request('/api/launch-commands', {
    headers: {
      Origin: 'https://example.invalid',
      'Sec-Fetch-Site': 'cross-site',
    },
  })

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'Forbidden origin' })
})

test('panel API allows trusted Tauri origins in production', async () => {
  const previous = process.env['NODE_ENV']
  process.env['NODE_ENV'] = 'production'
  try {
    const config = buildDefaultConfig()
    config.server.authToken = 'secret'
    const app = createPanelApp(config)

    const response = await app.request('/api/status', {
      headers: { Origin: 'https://tauri.localhost' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://tauri.localhost')
  } finally {
    if (previous === undefined) delete process.env['NODE_ENV']
    else process.env['NODE_ENV'] = previous
  }
})

test('panel API allows vite dev origin only outside production', async () => {
  const previous = process.env['NODE_ENV']
  delete process.env['NODE_ENV']
  try {
    const config = buildDefaultConfig()
    config.server.authToken = 'secret'
    const app = createPanelApp(config)

    const response = await app.request('/api/status', {
      headers: { Origin: 'http://localhost:5173' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173')
  } finally {
    if (previous === undefined) delete process.env['NODE_ENV']
    else process.env['NODE_ENV'] = previous
  }
})

test('panel API rejects vite dev origin in production', async () => {
  const previous = process.env['NODE_ENV']
  process.env['NODE_ENV'] = 'production'
  try {
    const config = buildDefaultConfig()
    config.server.authToken = 'secret'
    const app = createPanelApp(config)

    const response = await app.request('/api/status', {
      headers: { Origin: 'http://localhost:5173' },
    })

    assert.equal(response.status, 403)
  } finally {
    if (previous === undefined) delete process.env['NODE_ENV']
    else process.env['NODE_ENV'] = previous
  }
})

test('panel API accepts gateway token as explicit local bypass', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const response = await app.request('/api/status', {
    headers: {
      Origin: 'https://example.invalid',
      Authorization: 'Bearer secret',
    },
  })

  assert.equal(response.status, 200)
})

test('panel API keeps local curl-style reads working without Origin', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const response = await app.request('/api/status')

  assert.equal(response.status, 200)
  const body = await response.json() as { proxyPort?: number }
  assert.equal(body.proxyPort, config.server.proxyPort)
})

test('panel API requires token for sensitive local requests without Origin', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const response = await app.request('/api/launch-commands')

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'Authentication required' })
})

test('panel API allows sensitive local requests with gateway token', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const response = await app.request('/api/launch-commands', {
    headers: { Authorization: 'Bearer secret' },
  })

  assert.equal(response.status, 200)
  const body = await response.json() as { manual?: string }
  assert.ok(body.manual?.includes('ANTHROPIC_AUTH_TOKEN=secret'))
})

test('panel API rejects sensitive local requests with wrong gateway token', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const response = await app.request('/api/control/shutdown', {
    method: 'POST',
    headers: { Authorization: 'Bearer wrong' },
  })

  assert.equal(response.status, 401)
})

test('panel API rejects unknown shell names before installing snippets', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const response = await app.request('/api/shell-setup/install', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ shells: ['zsh', '../bad'] }),
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'Unknown shell: ../bad' })
})

test('PUT /api/config persists proxy settings and returns them on GET', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const putResponse = await app.request('/api/config', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ proxy: { enabled: true, url: 'http://127.0.0.1:7890' } }),
  })
  assert.equal(putResponse.status, 200)

  const getResponse = await app.request('/api/config', {
    headers: { Authorization: 'Bearer secret' },
  })
  const body = await getResponse.json() as { proxy?: { enabled: boolean; url: string } }
  assert.equal(body.proxy?.enabled, true)
  assert.equal(body.proxy?.url, 'http://127.0.0.1:7890')
})

test('PUT /api/config rejects invalid proxy URL when enabled', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const response = await app.request('/api/config', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ proxy: { enabled: true, url: 'not-a-url' } }),
  })
  assert.equal(response.status, 400)
  const body = await response.json() as { error: string }
  assert.ok(body.error.includes('http://') || body.error.includes('https://'))
})

test('PUT /api/config rejects proxy URL with embedded credentials even when disabled', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  for (const enabled of [true, false]) {
    const response = await app.request('/api/config', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ proxy: { enabled, url: 'http://user:pass@proxy.example.com:8080' } }),
    })
    assert.equal(response.status, 400, `expected rejection when enabled=${enabled}`)
    const body = await response.json() as { error: string }
    assert.ok(body.error.toLowerCase().includes('credential'))
  }
})

test('PUT /api/config rejects enabling proxy when existing URL is empty', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  const app = createPanelApp(config)

  const response = await app.request('/api/config', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ proxy: { enabled: true } }),
  })
  assert.equal(response.status, 400)
})

test('PUT /api/config disabling proxy clears the enabled flag', async () => {
  const config = buildDefaultConfig()
  config.server.authToken = 'secret'
  config.proxy = { enabled: true, url: 'http://127.0.0.1:7890' }
  const app = createPanelApp(config)

  const putResponse = await app.request('/api/config', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ proxy: { enabled: false } }),
  })
  assert.equal(putResponse.status, 200)

  const getResponse = await app.request('/api/config', {
    headers: { Authorization: 'Bearer secret' },
  })
  const body = await getResponse.json() as { proxy?: { enabled: boolean; url: string } }
  assert.equal(body.proxy?.enabled, false)
  assert.equal(body.proxy?.url, 'http://127.0.0.1:7890')
})
