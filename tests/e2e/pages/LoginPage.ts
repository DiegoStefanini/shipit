import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object Model for the /login page.
 */
export class LoginPage {
  readonly page: Page
  readonly heading: Locator
  readonly subtitle: Locator
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.locator('.login-header h1')
    this.subtitle = page.locator('.login-subtitle')
    this.usernameInput = page.locator('input[type="text"]')
    this.passwordInput = page.locator('input[type="password"]')
    this.submitButton = page.locator('button[type="submit"]')
    this.errorMessage = page.locator('[role="alert"]')
  }

  async goto() {
    await this.page.goto('/login')
    await this.page.waitForLoadState('networkidle')
  }

  async fillCredentials(username: string, password: string) {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
  }

  async submit() {
    await this.submitButton.click()
  }

  async login(username: string, password: string) {
    await this.fillCredentials(username, password)
    await this.submit()
  }

  async expectVisible() {
    await expect(this.heading).toContainText('ShipIt')
    await expect(this.usernameInput).toBeVisible()
    await expect(this.passwordInput).toBeVisible()
    await expect(this.submitButton).toBeVisible()
  }

  async expectError(message?: string) {
    await expect(this.errorMessage).toBeVisible()
    if (message) {
      await expect(this.errorMessage).toContainText(message)
    }
  }
}
