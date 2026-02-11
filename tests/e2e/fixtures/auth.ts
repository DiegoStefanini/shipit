import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Authentication credentials used by E2E tests.
 * Defaults match backend config defaults (ADMIN_USER / ADMIN_PASSWORD).
 * Override via SHIPIT_ADMIN_USER / SHIPIT_ADMIN_PASSWORD env vars.
 */
const ADMIN_USER = process.env.SHIPIT_ADMIN_USER ?? 'admin'
const ADMIN_PASSWORD = process.env.SHIPIT_ADMIN_PASSWORD ?? 'changeme'

/**
 * Path to cached token file. We persist the JWT to disk so it survives
 * across different Playwright worker processes (one per test file).
 */
const TOKEN_FILE = path.join(__dirname, '..', '..', '..', 'tmp-e2e', '.e2e-token')

/**
 * Module-level in-memory cache (fast path within same worker).
 */
let cachedToken: string | null = null

/**
 * Authenticate by calling the backend API directly.
 * Caches the token to both memory and disk, so it persists across workers
 * and avoids hitting the auth rate limit.
 */
async function getToken(request: APIRequestContext, baseURL: string): Promise<string> {
  // Fast path: in-memory cache
  if (cachedToken) return cachedToken

  // Check disk cache
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const diskToken = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
      if (diskToken) {
        // Validate the token is not expired by checking /api/auth/me
        const meRes = await request.get(`${baseURL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${diskToken}` },
        })
        if (meRes.ok()) {
          cachedToken = diskToken
          return cachedToken
        }
      }
    }
  } catch {
    // Disk read failed, fall through to login
  }

  // Actually log in
  const res = await request.post(`${baseURL}/api/auth/login`, {
    data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
  })

  if (!res.ok()) {
    throw new Error(`Login API failed with status ${res.status()}: ${await res.text()}`)
  }

  const { token } = await res.json()
  cachedToken = token as string

  // Write to disk for other workers
  try {
    const dir = path.dirname(TOKEN_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(TOKEN_FILE, cachedToken)
  } catch {
    // Non-fatal: other workers will just re-login
  }

  return cachedToken
}

/**
 * Helper to make authenticated API requests from tests.
 */
function createApiHelper(request: APIRequestContext, baseURL: string, token: string) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  return {
    get: (path: string) => request.get(`${baseURL}${path}`, { headers }),
    post: (path: string, data?: unknown) => request.post(`${baseURL}${path}`, { headers, data }),
    patch: (path: string, data?: unknown) => request.patch(`${baseURL}${path}`, { headers, data }),
    delete: (path: string) => request.delete(`${baseURL}${path}`, { headers }),
  }
}

type ApiHelper = ReturnType<typeof createApiHelper>

/**
 * Extended test fixture that provides:
 * - authedPage: a Page with JWT token in localStorage
 * - api: an API helper that includes the Authorization header
 */
export const test = base.extend<{ authedPage: Page; api: ApiHelper }>({
  authedPage: async ({ page, baseURL, request }, use) => {
    const url = baseURL ?? 'http://localhost:5173'
    const token = await getToken(request, url)

    // Navigate to origin so we can set localStorage on the right domain
    await page.goto(url)
    await page.evaluate((t) => {
      localStorage.setItem('shipit_token', t)
    }, token)

    // Reload so the app picks up the token
    await page.reload()
    await page.waitForLoadState('networkidle')

    await use(page)
  },

  api: async ({ baseURL, request }, use) => {
    const url = baseURL ?? 'http://localhost:5173'
    const token = await getToken(request, url)
    const helper = createApiHelper(request, url, token)
    await use(helper)
  },
})

export { expect, ADMIN_USER, ADMIN_PASSWORD }
