import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'
import { NavigationBar } from './pages/NavigationBar'

const ADMIN_USER = process.env.SHIPIT_ADMIN_USER ?? 'admin'
const ADMIN_PASSWORD = process.env.SHIPIT_ADMIN_PASSWORD ?? 'changeme'

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
  })

  test('login page renders correctly', async ({ page }) => {
    await loginPage.goto()
    await loginPage.expectVisible()

    // Verify the branding elements
    await expect(loginPage.heading).toContainText('ShipIt')
    await expect(loginPage.subtitle).toContainText('Sign in to your account')
    await expect(loginPage.submitButton).toContainText('Sign in')

    // Navbar should NOT be visible on login page (user is not authenticated)
    const navbar = new NavigationBar(page)
    await navbar.expectNotVisible()
  })

  test('login with valid credentials redirects to dashboard and shows navbar', async ({ page }) => {
    await loginPage.goto()
    await loginPage.fillCredentials(ADMIN_USER, ADMIN_PASSWORD)
    await loginPage.submit()

    // Should redirect to dashboard
    await page.waitForURL('**/', { timeout: 10000 })
    await expect(page.locator('h1', { hasText: 'Projects' })).toBeVisible({ timeout: 10000 })

    // Token should be stored in localStorage
    const token = await page.evaluate(() => localStorage.getItem('shipit_token'))
    expect(token).toBeTruthy()
    expect(token!.split('.')).toHaveLength(3) // JWT has 3 parts

    // Navbar should now be visible with username
    const navbar = new NavigationBar(page)
    await navbar.expectVisible()
    await navbar.expectUsername(ADMIN_USER)
  })

  test('login with wrong password shows error', async ({ page }) => {
    await loginPage.goto()
    await loginPage.login(ADMIN_USER, 'wrong-password')

    // Should stay on login page with error
    await loginPage.expectError('Invalid credentials')
    await expect(page).toHaveURL(/\/login/)

    // Token should NOT be stored
    const token = await page.evaluate(() => localStorage.getItem('shipit_token'))
    expect(token).toBeNull()
  })

  test('login with wrong username shows error', async ({ page }) => {
    await loginPage.goto()
    await loginPage.login('nonexistent-user', ADMIN_PASSWORD)

    await loginPage.expectError('Invalid credentials')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login with empty fields does not submit', async ({ page }) => {
    await loginPage.goto()

    // Click submit without filling anything
    await loginPage.submit()

    // Should stay on login page (HTML5 required validation prevents submit)
    await expect(page).toHaveURL(/\/login/)

    // No error message should appear (form was not submitted)
    await expect(loginPage.errorMessage).not.toBeVisible()
  })

  test('logout clears token and redirects to login', async ({ page }) => {
    // Inject token via API instead of going through login UI (avoids rate limit)
    const res = await page.request.post('/api/auth/login', {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    })
    expect(res.ok()).toBeTruthy()
    const { token } = await res.json()

    // Navigate to set localStorage on the correct origin, then go to dashboard
    await page.goto('/login')
    await page.evaluate((t) => localStorage.setItem('shipit_token', t), token)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify we are authenticated
    await expect(page.locator('h1', { hasText: 'Projects' })).toBeVisible({ timeout: 10000 })

    // Now logout
    const navbar = new NavigationBar(page)
    await navbar.logout()

    // Should be on login page
    await expect(page).toHaveURL(/\/login/)
    await loginPage.expectVisible()

    // Token should be cleared
    const storedToken = await page.evaluate(() => localStorage.getItem('shipit_token'))
    expect(storedToken).toBeNull()
  })

  test('accessing protected route without token redirects to login', async ({ page }) => {
    // Clear any existing token
    await page.goto('/login')
    await page.evaluate(() => localStorage.removeItem('shipit_token'))

    // Try to access the dashboard directly
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('accessing /hosts without token redirects to login', async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(() => localStorage.removeItem('shipit_token'))

    await page.goto('/hosts')
    await expect(page).toHaveURL(/\/login/)
  })

  test('accessing /settings without token redirects to login', async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(() => localStorage.removeItem('shipit_token'))

    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login/)
  })
})
