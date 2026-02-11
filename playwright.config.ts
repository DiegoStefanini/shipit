import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'authed-tests',
      testMatch: ['navigation.spec.ts', 'projects.spec.ts', 'hosts.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'auth-tests',
      testMatch: ['auth.spec.ts'],
      dependencies: ['authed-tests'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
