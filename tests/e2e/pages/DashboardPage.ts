import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object Model for the Dashboard (Projects list) page — route "/".
 */
export class DashboardPage {
  readonly page: Page
  readonly heading: Locator
  readonly subtitle: Locator
  readonly searchInput: Locator
  readonly newProjectLink: Locator
  readonly projectGrid: Locator
  readonly projectCards: Locator
  readonly emptyState: Locator
  readonly errorMessage: Locator
  readonly statsBar: Locator
  readonly loadingSkeleton: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.locator('h1', { hasText: 'Projects' })
    this.subtitle = page.locator('.page-subtitle')
    this.searchInput = page.locator('.search-input')
    this.newProjectLink = page.locator('a.btn-primary', { hasText: '+ New Project' })
    this.projectGrid = page.locator('.project-grid')
    this.projectCards = page.locator('.project-grid > *')
    this.emptyState = page.locator('.empty-state')
    this.errorMessage = page.locator('[role="alert"]')
    this.statsBar = page.locator('.stats-bar')
    this.loadingSkeleton = page.locator('.project-grid[role="status"]')
  }

  async goto() {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible()
    // Wait until skeleton is gone (loading finished)
    await expect(this.loadingSkeleton).toHaveCount(0, { timeout: 10000 })
  }

  async searchProjects(query: string) {
    await this.searchInput.fill(query)
  }

  async clickNewProject() {
    await this.newProjectLink.click()
    await this.page.waitForURL('**/new')
  }

  async getProjectCount(): Promise<number> {
    return await this.projectCards.count()
  }

  async expectEmpty() {
    await expect(this.emptyState).toBeVisible()
  }
}
