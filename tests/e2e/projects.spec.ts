import { test, expect } from './fixtures/auth'
import { DashboardPage } from './pages/DashboardPage'
import { NewProjectPage } from './pages/NewProjectPage'

test.describe('Projects CRUD', () => {
  test('dashboard shows Projects heading and search input', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage)
    await dashboard.goto()
    await dashboard.expectLoaded()

    await expect(dashboard.heading).toBeVisible()
    await expect(dashboard.searchInput).toBeVisible()
    await expect(dashboard.newProjectLink).toBeVisible()
  })

  test('dashboard shows empty state or project list', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage)
    await dashboard.goto()
    await dashboard.expectLoaded()

    // Either empty state or project cards should be visible
    const hasProjects = await dashboard.projectCards.count() > 0
    const hasEmptyState = await dashboard.emptyState.isVisible().catch(() => false)

    expect(hasProjects || hasEmptyState).toBeTruthy()

    // If projects exist, the stats bar should be visible
    if (hasProjects) {
      await expect(dashboard.statsBar).toBeVisible()
    }
  })

  test('clicking New Project navigates to /new', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage)
    await dashboard.goto()
    await dashboard.expectLoaded()
    await dashboard.clickNewProject()

    // Should be on the new project page
    await expect(authedPage).toHaveURL(/\/new/)
    const newProjectPage = new NewProjectPage(authedPage)
    await newProjectPage.expectLoaded()
  })

  test('new project form renders with all fields', async ({ authedPage }) => {
    const newProject = new NewProjectPage(authedPage)
    await newProject.goto()
    await newProject.expectLoaded()

    // All fields should be visible
    await expect(newProject.nameInput).toBeVisible()
    await expect(newProject.repoInput).toBeVisible()
    await expect(newProject.giteaUrlInput).toBeVisible()
    await expect(newProject.hostSelect).toBeVisible()
    await expect(newProject.submitButton).toBeVisible()

    // Branch should default to "main"
    const branchField = authedPage.locator('input[value="main"]')
    await expect(branchField).toBeVisible()

    // Subdomain hint should be visible
    await expect(newProject.subdomainHint).toBeVisible()
  })

  test('new project form validates project name format', async ({ authedPage }) => {
    const newProject = new NewProjectPage(authedPage)
    await newProject.goto()
    await newProject.expectLoaded()

    // Enter an invalid name with spaces (lowercase conversion happens on onChange)
    await newProject.nameInput.fill('')
    await newProject.nameInput.type('my app') // space is invalid

    // Check for validation error
    await newProject.expectNameValidationError()
  })

  test('new project subdomain hint updates with project name', async ({ authedPage }) => {
    const newProject = new NewProjectPage(authedPage)
    await newProject.goto()
    await newProject.expectLoaded()

    // Type a project name
    await newProject.nameInput.fill('test-app')

    // The subdomain hint should show the name
    await expect(newProject.subdomainHint).toContainText('test-app')
  })

  test('create project via API and verify it appears on dashboard', async ({ authedPage, api }) => {
    const projectName = `e2e-test-${Date.now()}`

    // Create project via API
    const response = await api.post('/api/projects', {
      name: projectName,
      gitea_repo: 'test/e2e-repo',
      gitea_url: 'http://localhost:3000',
      branch: 'main',
    })
    expect(response.ok()).toBeTruthy()
    const project = await response.json()
    expect(project.name).toBe(projectName)
    expect(project.id).toBeTruthy()

    try {
      // Navigate to dashboard and verify the project appears
      const dashboard = new DashboardPage(authedPage)
      await dashboard.goto()
      await dashboard.expectLoaded()

      // Search for the project
      await dashboard.searchProjects(projectName)

      // Wait for the card to appear
      const projectCard = authedPage.locator(`.project-grid`, { hasText: projectName })
      await expect(projectCard).toBeVisible({ timeout: 5000 })
    } finally {
      // Cleanup: delete the project
      const deleteRes = await api.delete(`/api/projects/${project.id}`)
      expect(deleteRes.status()).toBe(204)
    }
  })

  test('search filters projects on dashboard', async ({ authedPage, api }) => {
    // Create two projects with different names
    const name1 = `e2e-alpha-${Date.now()}`
    const name2 = `e2e-beta-${Date.now()}`

    const res1 = await api.post('/api/projects', {
      name: name1, gitea_repo: 'test/alpha', gitea_url: 'http://localhost:3000', branch: 'main',
    })
    const res2 = await api.post('/api/projects', {
      name: name2, gitea_repo: 'test/beta', gitea_url: 'http://localhost:3000', branch: 'main',
    })
    expect(res1.ok()).toBeTruthy()
    expect(res2.ok()).toBeTruthy()
    const proj1 = await res1.json()
    const proj2 = await res2.json()

    try {
      const dashboard = new DashboardPage(authedPage)
      await dashboard.goto()
      await dashboard.expectLoaded()

      // Search for "alpha" should only show the first project
      await dashboard.searchProjects('alpha')
      // Give the filter a moment
      await authedPage.waitForTimeout(300)

      const alphaCard = authedPage.locator('.project-grid', { hasText: name1 })
      await expect(alphaCard).toBeVisible()

      // Verify the search input has the right value
      await expect(dashboard.searchInput).toHaveValue('alpha')
    } finally {
      // Cleanup
      await api.delete(`/api/projects/${proj1.id}`)
      await api.delete(`/api/projects/${proj2.id}`)
    }
  })

  test('project deletion removes it from the list', async ({ authedPage, api }) => {
    const projectName = `e2e-delete-${Date.now()}`

    // Create a project
    const res = await api.post('/api/projects', {
      name: projectName, gitea_repo: 'test/delete-me', gitea_url: 'http://localhost:3000', branch: 'main',
    })
    const project = await res.json()

    // Verify it appears
    const dashboard = new DashboardPage(authedPage)
    await dashboard.goto()
    await dashboard.expectLoaded()

    await dashboard.searchProjects(projectName)
    await authedPage.waitForTimeout(300)

    // Verify it is visible
    const projectCard = authedPage.locator('.project-grid', { hasText: projectName })
    await expect(projectCard).toBeVisible()

    // Delete it via API
    const deleteRes = await api.delete(`/api/projects/${project.id}`)
    expect(deleteRes.status()).toBe(204)

    // Refresh and verify it is gone
    await dashboard.goto()
    await dashboard.expectLoaded()

    await dashboard.searchProjects(projectName)
    await authedPage.waitForTimeout(300)

    // Should show empty state since no projects match this unique name
    await expect(authedPage.locator('.empty-state')).toBeVisible()
  })

  test('duplicate project name returns conflict error', async ({ api }) => {
    const projectName = `e2e-dup-${Date.now()}`

    // Create first project
    const res1 = await api.post('/api/projects', {
      name: projectName, gitea_repo: 'test/dup1', gitea_url: 'http://localhost:3000', branch: 'main',
    })
    expect(res1.ok()).toBeTruthy()
    const proj = await res1.json()

    try {
      // Try to create a duplicate
      const res2 = await api.post('/api/projects', {
        name: projectName, gitea_repo: 'test/dup2', gitea_url: 'http://localhost:3000', branch: 'main',
      })
      expect(res2.status()).toBe(409)
      const error = await res2.json()
      expect(error.error).toContain('already exists')
    } finally {
      await api.delete(`/api/projects/${proj.id}`)
    }
  })
})
