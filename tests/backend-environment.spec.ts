import { expect, test } from '@playwright/test'
import { backendTestEnvironment } from './backend-environment.ts'

const isolated = {
  NODE_ENV: 'test',
  BROWSER_TEST_DATABASE_URL: 'postgresql://coffee_browser_test:coffee_browser_test@127.0.0.1:15432/coffee_shop_browser_test?schema=public',
  BROWSER_TEST_REDIS_URL: 'redis://127.0.0.1:16379/0',
}

test('fixture mode does not proxy unmocked mutations to the business backend', async ({ request }) => {
  const response = await request.post('/api/v1/auth/sign-in', { data: {} })
  expect(response.status()).toBe(404)
})

test('integration rejects production, business DB, remote infrastructure and shared ports', () => {
  for (const overrides of [
    { NODE_ENV: 'production' },
    { BROWSER_TEST_DATABASE_URL: undefined },
    { BROWSER_TEST_DATABASE_URL: isolated.BROWSER_TEST_DATABASE_URL.replace('coffee_shop_browser_test?', 'db_nestjs_coffee_shop_be?') },
    { BROWSER_TEST_DATABASE_URL: isolated.BROWSER_TEST_DATABASE_URL.replace('15432', '5432') },
    { BROWSER_TEST_DATABASE_URL: isolated.BROWSER_TEST_DATABASE_URL.replace('127.0.0.1', 'db.example.com') },
    { BROWSER_TEST_REDIS_URL: 'redis://127.0.0.1:6379' },
    { BROWSER_TEST_REDIS_URL: 'redis://redis.example.com:16379' },
  ]) expect(() => backendTestEnvironment({ ...isolated, ...overrides })).toThrow('Never use the business database')
  expect(backendTestEnvironment(isolated)).toMatchObject({ NODE_ENV: 'test', CSRF_ENABLED: 'true', PORT: '8889' })
  expect(backendTestEnvironment({ ...isolated, THROTTLE_LIMIT: '999999' }))
    .toMatchObject({ THROTTLE_LIMIT: '1000', THROTTLE_TTL: '60000' })
  expect(backendTestEnvironment({ ...isolated, TELEGRAM_BOT_TOKEN: 'must-not-use', GOOGLE_CLIENT_ID: 'must-not-use' }))
    .toMatchObject({ GOOGLE_CLIENT_ID: '', TURNSTILE_SECRET_KEY: '', TELEGRAM_BOT_TOKEN: '', TELEGRAM_BOT_USERNAME: '', TELEGRAM_WEBHOOK_SECRET: '' })
})
