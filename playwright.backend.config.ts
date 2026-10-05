import { defineConfig, devices } from '@playwright/test'
import { backendTestEnvironment } from './tests/backend-environment.ts'

const env = backendTestEnvironment()
export default defineConfig({
  testDir: './tests', testMatch: '**/live-backend.spec.ts', outputDir: './test-results/backend',
  fullyParallel: false, workers: 1, retries: 0,
  timeout: 120_000, expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI), reporter: 'list',
  tsconfig: './tsconfig.app.json',
  use: { baseURL: 'http://localhost:4174', channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', grepInvert: /@api-only/, use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', grepInvert: /@api-only/, use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'api', grep: /@api-only/ },
  ],
  webServer: [
    { command: 'pnpm --dir ../coffee_shop_be start:prod', env,
      url: 'http://127.0.0.1:8889/api/v1/health/ready', timeout: 120_000, reuseExistingServer: false },
    { command: 'pnpm dev --port 4174 --mode browser-integration', env, url: 'http://localhost:4174', reuseExistingServer: false },
  ],
})
