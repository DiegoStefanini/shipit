import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object Model for the /hosts page.
 */
export class HostsPage {
  readonly page: Page
  readonly heading: Locator
  readonly searchInput: Locator
  readonly addHostButton: Locator
  readonly hostGrid: Locator
  readonly hostCards: Locator
  readonly emptyState: Locator
  readonly loadingSkeleton: Locator
  readonly statsBar: Locator

  // Add-host form elements
  readonly formSection: Locator
  readonly formHeading: Locator
  readonly nameInput: Locator
  readonly typeSelect: Locator
  readonly vmidInput: Locator
  readonly ipInput: Locator
  readonly sshPortInput: Locator
  readonly sshUserInput: Locator
  readonly sshKeyInput: Locator
  readonly hasDockerCheckbox: Locator
  readonly hasCrowdsecCheckbox: Locator
  readonly createHostButton: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.locator('h1', { hasText: 'Hosts' })
    this.searchInput = page.locator('.search-input')
    this.addHostButton = page.locator('button.btn-primary', { hasText: /Add Host|Cancel/ })
    this.hostGrid = page.locator('.project-grid')
    this.hostCards = page.locator('.project-grid > *')
    this.emptyState = page.locator('.empty-state')
    this.loadingSkeleton = page.locator('.project-grid[role="status"]')
    this.statsBar = page.locator('.stats-bar')

    // Form locators (visible only when form is open)
    this.formSection = page.locator('.settings-section')
    this.formHeading = page.locator('h2', { hasText: 'Add Host' })
    this.nameInput = page.locator('input[placeholder="docker-host"]')
    this.typeSelect = this.formSection.locator('select')
    this.vmidInput = page.locator('input[placeholder="101"]')
    this.ipInput = page.locator('input[placeholder="192.168.1.44"]')
    this.sshPortInput = this.formSection.locator('label:has-text("SSH Port") + input, label:has-text("SSH Port") ~ input').first()
    this.sshUserInput = this.formSection.locator('label:has-text("SSH User") + input, label:has-text("SSH User") ~ input').first()
    this.sshKeyInput = page.locator('input[placeholder="/home/shipit/.ssh/id_ed25519"]')
    this.hasDockerCheckbox = this.formSection.locator('text=Has Docker >> input[type="checkbox"]')
    this.hasCrowdsecCheckbox = this.formSection.locator('text=Has CrowdSec >> input[type="checkbox"]')
    this.createHostButton = this.formSection.locator('button[type="submit"]', { hasText: /Create Host|Creating/ })
  }

  async goto() {
    await this.page.goto('/hosts')
    await this.page.waitForLoadState('networkidle')
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible()
    await expect(this.loadingSkeleton).toHaveCount(0, { timeout: 10000 })
  }

  async openAddHostForm() {
    // If form is already open, do nothing
    if (await this.formSection.isVisible().catch(() => false)) return
    await this.addHostButton.click()
    await expect(this.formHeading).toBeVisible()
  }

  async closeAddHostForm() {
    if (!(await this.formSection.isVisible().catch(() => false))) return
    await this.addHostButton.click()
    await expect(this.formSection).not.toBeVisible()
  }

  async fillHostForm(data: {
    name: string
    type?: 'vm' | 'ct'
    vmid?: string
    ip: string
    sshPort?: string
    sshUser?: string
    sshKeyPath?: string
    hasDocker?: boolean
    hasCrowdsec?: boolean
  }) {
    await this.nameInput.fill(data.name)
    if (data.type) {
      await this.typeSelect.selectOption(data.type)
    }
    if (data.vmid) {
      await this.vmidInput.fill(data.vmid)
    }
    await this.ipInput.fill(data.ip)
    if (data.sshPort) {
      // The SSH port field has default value "22", clear and fill
      const portField = this.formSection.locator('input').nth(4) // 5th input in the form
      await portField.clear()
      await portField.fill(data.sshPort)
    }
    if (data.sshUser) {
      const userField = this.formSection.locator('input').nth(5) // 6th input in the form
      await userField.clear()
      await userField.fill(data.sshUser)
    }
    if (data.sshKeyPath) {
      await this.sshKeyInput.fill(data.sshKeyPath)
    }
    if (data.hasDocker) {
      await this.hasDockerCheckbox.check()
    }
    if (data.hasCrowdsec) {
      await this.hasCrowdsecCheckbox.check()
    }
  }

  async submitHostForm() {
    await this.createHostButton.click()
  }

  async searchHosts(query: string) {
    await this.searchInput.fill(query)
  }

  async getHostCount(): Promise<number> {
    return await this.hostCards.count()
  }

  async expectEmpty() {
    await expect(this.emptyState).toBeVisible()
  }
}
