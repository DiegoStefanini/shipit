import { test, expect } from './fixtures/auth'
import { NavigationBar } from './pages/NavigationBar'

test.describe('Navigation', () => {
  test('navbar is visible after login and shows all sections', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.expectVisible()

    // All nav links should be present
    await expect(nav.projectsLink).toBeVisible()
    await expect(nav.hostsLink).toBeVisible()
    await expect(nav.monitoringLink).toBeVisible()
    await expect(nav.logsLink).toBeVisible()
    await expect(nav.securityLink).toBeVisible()
    await expect(nav.alertsLink).toBeVisible()

    // Action buttons in the right section
    await expect(nav.newButton).toBeVisible()
    await expect(nav.settingsButton).toBeVisible()
    await expect(nav.logoutButton).toBeVisible()
  })

  test('logo links to dashboard', async ({ authedPage }) => {
    // Start on a different page
    await authedPage.goto('/hosts')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.logo.click()
    await authedPage.waitForURL('**/')
    await expect(authedPage.locator('h1', { hasText: 'Projects' })).toBeVisible()
  })

  test('navigate to Projects page', async ({ authedPage }) => {
    await authedPage.goto('/hosts') // start elsewhere
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.navigateTo('projects')

    await expect(authedPage).toHaveURL(/^\/$|\/$/  )
    await expect(authedPage.locator('h1', { hasText: 'Projects' })).toBeVisible()
  })

  test('navigate to Hosts page', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.navigateTo('hosts')

    await expect(authedPage).toHaveURL(/\/hosts/)
    await expect(authedPage.locator('h1', { hasText: 'Hosts' })).toBeVisible()
  })

  test('navigate to Monitoring page', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.navigateTo('monitoring')

    await expect(authedPage).toHaveURL(/\/monitoring/)
    await expect(authedPage.locator('h1', { hasText: 'Monitoring' })).toBeVisible()
  })

  test('navigate to Logs page', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.navigateTo('logs')

    await expect(authedPage).toHaveURL(/\/logs/)
    await expect(authedPage.locator('h1', { hasText: 'Logs' })).toBeVisible()
  })

  test('navigate to Security page', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.navigateTo('security')

    await expect(authedPage).toHaveURL(/\/security/)
    await expect(authedPage.locator('h1', { hasText: 'Security' })).toBeVisible()
  })

  test('navigate to Alerts page', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.navigateTo('alerts')

    await expect(authedPage).toHaveURL(/\/alerts/)
    await expect(authedPage.locator('h1', { hasText: 'Alerts' })).toBeVisible()
  })

  test('navigate to Settings page', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.navigateTo('settings')

    await expect(authedPage).toHaveURL(/\/settings/)
    await expect(authedPage.locator('h1', { hasText: 'Settings' })).toBeVisible()
  })

  test('+ New button navigates to /new', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.clickNewProject()

    await expect(authedPage).toHaveURL(/\/new/)
    await expect(authedPage.locator('h1', { hasText: 'New Project' })).toBeVisible()
  })

  test('active nav link is highlighted on Projects page', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.expectActiveLink('projects')
  })

  test('active nav link is highlighted on Hosts page', async ({ authedPage }) => {
    await authedPage.goto('/hosts')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.expectActiveLink('hosts')
  })

  test('active nav link is highlighted on Monitoring page', async ({ authedPage }) => {
    await authedPage.goto('/monitoring')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    await nav.expectActiveLink('monitoring')
  })

  test('username is displayed in the navbar', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)
    const adminUser = process.env.SHIPIT_ADMIN_USER ?? 'admin'
    await nav.expectUsername(adminUser)
  })

  test('full navigation round-trip through all pages', async ({ authedPage }) => {
    await authedPage.goto('/')
    await authedPage.waitForLoadState('networkidle')

    const nav = new NavigationBar(authedPage)

    // Projects -> Hosts -> Monitoring -> Logs -> Security -> Alerts -> Settings -> Projects
    const pages = [
      { section: 'hosts' as const, url: /\/hosts/, heading: 'Hosts' },
      { section: 'monitoring' as const, url: /\/monitoring/, heading: 'Monitoring' },
      { section: 'logs' as const, url: /\/logs/, heading: 'Logs' },
      { section: 'security' as const, url: /\/security/, heading: 'Security' },
      { section: 'alerts' as const, url: /\/alerts/, heading: 'Alerts' },
      { section: 'settings' as const, url: /\/settings/, heading: 'Settings' },
      { section: 'projects' as const, url: /^\/$|\/$/  , heading: 'Projects' },
    ]

    for (const p of pages) {
      await nav.navigateTo(p.section)
      await expect(authedPage).toHaveURL(p.url)
      await expect(authedPage.locator('h1', { hasText: p.heading })).toBeVisible()
    }
  })
})
