import { test, expect } from './fixtures/auth'
import { HostsPage } from './pages/HostsPage'

test.describe('Hosts Management', () => {
  test('hosts page renders with heading and controls', async ({ authedPage }) => {
    const hosts = new HostsPage(authedPage)
    await hosts.goto()
    await hosts.expectLoaded()

    await expect(hosts.heading).toBeVisible()
    await expect(hosts.searchInput).toBeVisible()
    await expect(hosts.addHostButton).toBeVisible()
  })

  test('hosts page shows empty state or host list', async ({ authedPage }) => {
    const hosts = new HostsPage(authedPage)
    await hosts.goto()
    await hosts.expectLoaded()

    const hostCount = await hosts.getHostCount()
    const hasEmptyState = await hosts.emptyState.isVisible().catch(() => false)

    expect(hostCount > 0 || hasEmptyState).toBeTruthy()

    if (hostCount > 0) {
      await expect(hosts.statsBar).toBeVisible()
    }
  })

  test('add host form toggles open and closed', async ({ authedPage }) => {
    const hosts = new HostsPage(authedPage)
    await hosts.goto()
    await hosts.expectLoaded()

    // Form should be hidden initially
    await expect(hosts.formSection).not.toBeVisible()

    // Open the form
    await hosts.openAddHostForm()
    await expect(hosts.formSection).toBeVisible()
    await expect(hosts.formHeading).toBeVisible()

    // The button text should now say "Cancel"
    await expect(hosts.addHostButton).toContainText('Cancel')

    // Close the form
    await hosts.closeAddHostForm()
    await expect(hosts.formSection).not.toBeVisible()

    // The button text should go back to "+ Add Host"
    await expect(hosts.addHostButton).toContainText('+ Add Host')
  })

  test('add host form has all required fields', async ({ authedPage }) => {
    const hosts = new HostsPage(authedPage)
    await hosts.goto()
    await hosts.expectLoaded()
    await hosts.openAddHostForm()

    // Verify all form elements
    await expect(hosts.nameInput).toBeVisible()
    await expect(hosts.typeSelect).toBeVisible()
    await expect(hosts.vmidInput).toBeVisible()
    await expect(hosts.ipInput).toBeVisible()
    await expect(hosts.sshKeyInput).toBeVisible()
    await expect(hosts.hasDockerCheckbox).toBeVisible()
    await expect(hosts.hasCrowdsecCheckbox).toBeVisible()
    await expect(hosts.createHostButton).toBeVisible()

    // Type select should have VM and CT options
    const options = hosts.typeSelect.locator('option')
    await expect(options).toHaveCount(2)
  })

  test('create host via API and verify it appears in list', async ({ authedPage, api }) => {
    const hostName = `e2e-host-${Date.now()}`

    // Create host via API
    const response = await api.post('/api/hosts', {
      name: hostName,
      type: 'vm',
      ip_address: '10.0.0.99',
      ssh_port: 22,
      ssh_user: 'testuser',
      has_docker: 1,
      has_crowdsec: 0,
    })
    expect(response.ok()).toBeTruthy()
    const host = await response.json()
    expect(host.name).toBe(hostName)
    expect(host.id).toBeTruthy()

    try {
      // Navigate to hosts page and verify it appears
      const hostsPage = new HostsPage(authedPage)
      await hostsPage.goto()
      await hostsPage.expectLoaded()

      // Search for the host
      await hostsPage.searchHosts(hostName)
      await authedPage.waitForTimeout(300)

      // The host should appear in the grid
      const hostCard = authedPage.locator('.project-grid', { hasText: hostName })
      await expect(hostCard).toBeVisible({ timeout: 5000 })
    } finally {
      // Cleanup
      await api.delete(`/api/hosts/${host.id}`)
    }
  })

  test('create host via the UI form', async ({ authedPage, api }) => {
    const hostName = `e2e-form-${Date.now()}`

    const hosts = new HostsPage(authedPage)
    await hosts.goto()
    await hosts.expectLoaded()
    await hosts.openAddHostForm()

    // Fill the form
    await hosts.nameInput.fill(hostName)
    await hosts.ipInput.fill('10.0.0.100')

    // Submit
    await hosts.submitHostForm()

    // Wait for the API response
    await authedPage.waitForResponse(
      (res) => res.url().includes('/api/hosts') && res.request().method() === 'POST',
      { timeout: 10000 }
    )

    // Give the UI time to update
    await authedPage.waitForTimeout(500)

    // The form should be closed after successful creation
    await expect(hosts.formSection).not.toBeVisible({ timeout: 5000 })

    // Verify the host appears in the list
    await hosts.searchHosts(hostName)
    await authedPage.waitForTimeout(300)
    const hostCard = authedPage.locator('.project-grid', { hasText: hostName })
    await expect(hostCard).toBeVisible({ timeout: 5000 })

    // Cleanup: find the host ID and delete it
    const listRes = await api.get('/api/hosts')
    const allHosts = await listRes.json()
    const createdHost = allHosts.find((h: { name: string }) => h.name === hostName)
    if (createdHost) {
      await api.delete(`/api/hosts/${createdHost.id}`)
    }
  })

  test('host deletion removes it from the list', async ({ authedPage, api }) => {
    const hostName = `e2e-del-host-${Date.now()}`

    // Create a host
    const res = await api.post('/api/hosts', {
      name: hostName,
      type: 'ct',
      ip_address: '10.0.0.101',
      ssh_port: 22,
      ssh_user: 'root',
      has_docker: 0,
      has_crowdsec: 0,
    })
    const host = await res.json()

    // Verify it appears
    const hostsPage = new HostsPage(authedPage)
    await hostsPage.goto()
    await hostsPage.expectLoaded()

    await hostsPage.searchHosts(hostName)
    await authedPage.waitForTimeout(300)
    const hostCard = authedPage.locator('.project-grid', { hasText: hostName })
    await expect(hostCard).toBeVisible()

    // Delete it
    const deleteRes = await api.delete(`/api/hosts/${host.id}`)
    expect(deleteRes.status()).toBe(204)

    // Refresh and verify it is gone
    await hostsPage.goto()
    await hostsPage.expectLoaded()

    await hostsPage.searchHosts(hostName)
    await authedPage.waitForTimeout(300)

    // Should show empty state
    await expect(authedPage.locator('.empty-state')).toBeVisible()
  })

  test('duplicate host name returns conflict error', async ({ api }) => {
    const hostName = `e2e-dup-host-${Date.now()}`

    // Create first host
    const res1 = await api.post('/api/hosts', {
      name: hostName, type: 'vm', ip_address: '10.0.0.200', ssh_port: 22, ssh_user: 'root', has_docker: 0, has_crowdsec: 0,
    })
    expect(res1.ok()).toBeTruthy()
    const host = await res1.json()

    try {
      // Try to create a duplicate
      const res2 = await api.post('/api/hosts', {
        name: hostName, type: 'vm', ip_address: '10.0.0.201', ssh_port: 22, ssh_user: 'root', has_docker: 0, has_crowdsec: 0,
      })
      expect(res2.status()).toBe(409)
      const error = await res2.json()
      expect(error.error).toContain('already exists')
    } finally {
      await api.delete(`/api/hosts/${host.id}`)
    }
  })

  test('search filters hosts by name', async ({ authedPage, api }) => {
    const name1 = `e2e-srv-alpha-${Date.now()}`
    const name2 = `e2e-srv-beta-${Date.now()}`

    const res1 = await api.post('/api/hosts', {
      name: name1, type: 'vm', ip_address: '10.0.1.1', ssh_port: 22, ssh_user: 'root', has_docker: 0, has_crowdsec: 0,
    })
    const res2 = await api.post('/api/hosts', {
      name: name2, type: 'vm', ip_address: '10.0.1.2', ssh_port: 22, ssh_user: 'root', has_docker: 0, has_crowdsec: 0,
    })
    const host1 = await res1.json()
    const host2 = await res2.json()

    try {
      const hostsPage = new HostsPage(authedPage)
      await hostsPage.goto()
      await hostsPage.expectLoaded()

      // Search for "alpha"
      await hostsPage.searchHosts('alpha')
      await authedPage.waitForTimeout(300)

      // Verify the search input has the right value
      await expect(hostsPage.searchInput).toHaveValue('alpha')

      // The alpha host should be visible
      const alphaCard = authedPage.locator('.project-grid', { hasText: name1 })
      await expect(alphaCard).toBeVisible()
    } finally {
      await api.delete(`/api/hosts/${host1.id}`)
      await api.delete(`/api/hosts/${host2.id}`)
    }
  })

  test('search filters hosts by IP address', async ({ authedPage, api }) => {
    const hostName = `e2e-ip-search-${Date.now()}`
    const hostIp = '10.99.99.42'

    const res = await api.post('/api/hosts', {
      name: hostName, type: 'vm', ip_address: hostIp, ssh_port: 22, ssh_user: 'root', has_docker: 0, has_crowdsec: 0,
    })
    const host = await res.json()

    try {
      const hostsPage = new HostsPage(authedPage)
      await hostsPage.goto()
      await hostsPage.expectLoaded()

      // Search by IP
      await hostsPage.searchHosts('10.99.99')
      await authedPage.waitForTimeout(300)

      // Should find our host
      const hostCard = authedPage.locator('.project-grid', { hasText: hostName })
      await expect(hostCard).toBeVisible()
    } finally {
      await api.delete(`/api/hosts/${host.id}`)
    }
  })
})
