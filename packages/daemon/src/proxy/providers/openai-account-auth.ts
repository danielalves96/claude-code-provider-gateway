import { createHash, randomBytes } from 'node:crypto'
import type { ProviderOAuthConfig } from '../../config/schema.js'

export const OPENAI_ACCOUNT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
export const OPENAI_ACCOUNT_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize'
export const OPENAI_ACCOUNT_TOKEN_URL = 'https://auth.openai.com/oauth/token'
export const OPENAI_ACCOUNT_REDIRECT_URI = 'http://localhost:1455/auth/callback'
export const OPENAI_ACCOUNT_SCOPE = 'openid profile email offline_access'
const OPENAI_UNSUPPORTED_REGION_CODE = 'unsupported_country_region_territory'

export interface PkcePair {
  verifier: string
  challenge: string
}

export interface OAuthTokenResult {
  accessToken: string
  refreshToken: string
  expiresAt: number
  accountId?: string
  planType?: string
}

export function createState(): string {
  return randomBytes(16).toString('hex')
}

export function createPkcePair(): PkcePair {
  const verifier = base64Url(randomBytes(32))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function createAuthorizationUrl(pkce: PkcePair, state: string): string {
  const url = new URL(OPENAI_ACCOUNT_AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', OPENAI_ACCOUNT_CLIENT_ID)
  url.searchParams.set('redirect_uri', OPENAI_ACCOUNT_REDIRECT_URI)
  url.searchParams.set('scope', OPENAI_ACCOUNT_SCOPE)
  url.searchParams.set('code_challenge', pkce.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  url.searchParams.set('id_token_add_organizations', 'true')
  url.searchParams.set('codex_cli_simplified_flow', 'true')
  url.searchParams.set('originator', 'codex_cli_rs')
  return url.toString()
}

export async function exchangeAuthorizationCode(code: string, verifier: string): Promise<OAuthTokenResult> {
  return exchangeToken({
    grant_type: 'authorization_code',
    client_id: OPENAI_ACCOUNT_CLIENT_ID,
    code,
    code_verifier: verifier,
    redirect_uri: OPENAI_ACCOUNT_REDIRECT_URI,
  })
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
  return exchangeToken({
    grant_type: 'refresh_token',
    client_id: OPENAI_ACCOUNT_CLIENT_ID,
    refresh_token: refreshToken,
  })
}

export function isOAuthReady(oauth: ProviderOAuthConfig | undefined): boolean {
  return !!oauth?.accessToken && !!oauth.refreshToken && !!oauth.accountId
}

export function shouldRefresh(oauth: ProviderOAuthConfig | undefined): boolean {
  if (!oauth?.accessToken || !oauth.refreshToken || !oauth.expiresAt) return true
  return oauth.expiresAt - Date.now() < 5 * 60 * 1000
}

export function decodeOpenAIAccountClaims(accessToken: string): Pick<OAuthTokenResult, 'accountId' | 'planType'> {
  const payload = decodeJwt(accessToken)
  const auth = payload?.['https://api.openai.com/auth'] as Record<string, unknown> | undefined
  return {
    accountId: typeof auth?.['chatgpt_account_id'] === 'string' ? auth['chatgpt_account_id'] : undefined,
    planType: typeof auth?.['chatgpt_plan_type'] === 'string' ? auth['chatgpt_plan_type'] : undefined,
  }
}

async function exchangeToken(params: Record<string, string>): Promise<OAuthTokenResult> {
  const response = await fetch(OPENAI_ACCOUNT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(formatTokenExchangeError(response.status, text))
  }

  const json = await response.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
    throw new Error('OpenAI OAuth token response did not include access_token, refresh_token, and expires_in')
  }

  const claims = decodeOpenAIAccountClaims(json.access_token)
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    ...claims,
  }
}

function formatTokenExchangeError(status: number, body: string): string {
  const openaiError = parseOpenAIError(body)
  if (openaiError?.code === OPENAI_UNSUPPORTED_REGION_CODE) {
    return [
      'OpenAI OAuth token exchange failed:',
      'OpenAI rejected the daemon token exchange because the outbound network is in an unsupported country, region, or territory.',
      'Configure the daemon to use a supported outbound proxy/network and try logging in again.',
      `(${OPENAI_UNSUPPORTED_REGION_CODE})`,
    ].join(' ')
  }

  if (openaiError) {
    const details = [
      openaiError.code,
      openaiError.type,
      openaiError.message,
    ].filter(Boolean).join(' ')
    return `OpenAI OAuth token exchange failed: HTTP ${status} ${details}`.trim()
  }

  return `OpenAI OAuth token exchange failed: HTTP ${status} ${body.slice(0, 300)}`
}

function parseOpenAIError(body: string): { code?: string; message?: string; type?: string } | null {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: unknown; message?: unknown; type?: unknown } }
    const error = parsed.error
    if (!error) return null
    return {
      code: typeof error.code === 'string' ? error.code : undefined,
      message: typeof error.message === 'string' ? error.message : undefined,
      type: typeof error.type === 'string' ? error.type : undefined,
    }
  } catch {
    return null
  }
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function base64Url(input: Buffer): string {
  return input.toString('base64url')
}
