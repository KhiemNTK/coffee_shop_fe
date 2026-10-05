import { defineConfig } from '@playwright/test'
import base from './playwright.config.ts'

export default defineConfig({
  ...base,
  testMatch: '**/google-auth.spec.ts',
  testIgnore: [],
  outputDir: './test-results/google',
  webServer: {
    command: 'pnpm dev --port 4173 --mode browser-google',
    env: {
      VITE_TURNSTILE_SITE_KEY: 'browser-fixture-site-key',
      VITE_GOOGLE_CLIENT_ID: 'browser-fixture.apps.googleusercontent.com',
    },
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
})
