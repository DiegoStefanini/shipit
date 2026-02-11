import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object Model for the top navigation bar.
 * Only visible when authenticated.
 */
export class NavigationBar {
  readonly page: Page
  readonly navbar: Locator
  readonly logo: Locator
  readonly projectsLink: Locator
  readonly hostsLink: Locator
  readonly monitoringLink: Locator
  readonly logsLink: Locator
  readonly securityLink: Locator
  readonly alertsLink: Locator
  readonly newButton: Locator
  readonly settingsButton: Locator
  readonly logoutButton: Locator
  readonly usernameDisplay: Locator
  readonly menuToggle: Locator

  constructor(page: Page) {
    this.page = page
    this.navbar = page.locator('.navbar')
    this.logo = page.locator('.navbar-logo')
    this.projectsLink = page.locator('.navbar-link', { hasText: 'Projects' })
    this.hostsLink = page.locator('.navbar-link', { hasText: 'Hosts' })
    this.monitoringLink = page.locator('.navbar-link', { hasText: 'Monitoring' })
    this.logsLink = page.locator('.navbar-link', { hasText: 'Logs' })
    this.securityLink = page.locator('.navbar-link', { hasText: 'Security' })
    this.alertsLink = page.locator('.navbar-link', { hasText: 'Alerts' })
    this.newButton = page.locator('.navbar-right a.btn-primary', { hasText: '+ New' })
    this.settingsButton = page.locator('.navbar-right a.btn', { hasText: 'Settings' })
    this.logoutButton = page.locator('.navbar-right button.btn', { hasText: 'Logout' })
    this.usernameDisplay = page.locator('.navbar-user')
    this.menuToggle = page.locator('.navbar-toggle')
  }

  async expectVisible() {
    await expect(this.navbar).toBeVisible()
    await expect(this.logo).toBeVisible()
  }

  async expectNotVisible() {
    await expect(this.navbar).not.toBeVisible()
  }

  async expectUsername(name: string) {
    await expect(this.usernameDisplay).toContainText(name)
  }

  async navigateTo(section: 'projects' | 'hosts' | 'monitoring' | 'logs' | 'security' | 'alerts' | 'settings') {
    const linkMap: Record<string, Locator> = {
      projects: this.projectsLink,
      hosts: this.hostsLink,
      monitoring: this.monitoringLink,
      logs: this.logsLink,
      security: this.securityLink,
      alerts: this.alertsLink,
      settings: this.settingsButton,
    }
    const link = linkMap[section]
    await link.click()
    await this.page.waitForLoadState('networkidle')
  }

  async logout() {
    await this.logoutButton.click()
    await this.page.waitForURL('**/login')
  }

  async clickNewProject() {
    await this.newButton.click()
    await this.page.waitForURL('**/new')
  }

  async expectActiveLink(section: string) {
    const linkMap: Record<string, Locator> = {
      projects: this.projectsLink,
      hosts: this.hostsLink,
      monitoring: this.monitoringLink,
      logs: this.logsLink,
      security: this.securityLink,
      alerts: this.alertsLink,
    }
    const link = linkMap[section]
    if (link) {
      await expect(link).toHaveClass(/active/)
    }
  }
}
