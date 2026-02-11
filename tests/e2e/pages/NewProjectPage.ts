import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object Model for the /new (New Project) page.
 */
export class NewProjectPage {
  readonly page: Page
  readonly heading: Locator
  readonly nameInput: Locator
  readonly repoInput: Locator
  readonly giteaUrlInput: Locator
  readonly branchInput: Locator
  readonly hostSelect: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly nameError: Locator
  readonly subdomainHint: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.locator('h1', { hasText: 'New Project' })
    this.nameInput = page.locator('input[placeholder="my-app"]')
    this.repoInput = page.locator('input[placeholder="owner/repo"]')
    this.giteaUrlInput = page.locator('input[type="url"]')
    this.branchInput = page.locator('.form-container input[type="text"]').nth(2) // 3rd text input (after name and repo)
    this.hostSelect = page.locator('select')
    this.submitButton = page.locator('button[type="submit"]', { hasText: /Create Project|Creating/ })
    this.errorMessage = page.locator('.error-msg')
    this.nameError = page.locator('.form-error')
    this.subdomainHint = page.locator('.form-hint').first()
  }

  async goto() {
    await this.page.goto('/new')
    await this.page.waitForLoadState('networkidle')
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible()
    await expect(this.nameInput).toBeVisible()
    await expect(this.repoInput).toBeVisible()
  }

  async fillForm(data: {
    name: string
    repo: string
    giteaUrl?: string
    branch?: string
    hostId?: string
  }) {
    await this.nameInput.fill(data.name)
    await this.repoInput.fill(data.repo)
    if (data.giteaUrl) {
      await this.giteaUrlInput.clear()
      await this.giteaUrlInput.fill(data.giteaUrl)
    }
    if (data.branch) {
      await this.branchInput.clear()
      await this.branchInput.fill(data.branch)
    }
    if (data.hostId) {
      await this.hostSelect.selectOption(data.hostId)
    }
  }

  async submit() {
    await this.submitButton.click()
  }

  async expectNameValidationError() {
    await expect(this.nameError).toBeVisible()
    await expect(this.nameError).toContainText('Only lowercase letters')
  }
}
