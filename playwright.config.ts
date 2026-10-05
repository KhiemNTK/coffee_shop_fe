import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/fixtures',
  testIgnore: ['**/live-backend.spec.ts', '**/google-auth.spec.ts'],
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  tsconfig: './tsconfig.app.json',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 4173 --mode browser-fixtures',
    env: { VITE_TURNSTILE_SITE_KEY: 'browser-fixture-site-key', VITE_GOOGLE_CLIENT_ID: '' },
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
})
