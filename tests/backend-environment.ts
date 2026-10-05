export function backendTestEnvironment(raw: Record<string, string | undefined> = process.env) {
  const reject = () => { throw new Error('Browser integration requires NODE_ENV=test and dedicated loopback PostgreSQL:15432 / Redis:16379. Never use the business database.') }
  if (raw.NODE_ENV !== 'test' || !raw.BROWSER_TEST_DATABASE_URL || !raw.BROWSER_TEST_REDIS_URL) return reject()
  let database: URL, redis: URL
  try {
    database = new URL(raw.BROWSER_TEST_DATABASE_URL)
    redis = new URL(raw.BROWSER_TEST_REDIS_URL)
  } catch { return reject() }
  const loopback = (url: URL) => ['localhost', '127.0.0.1'].includes(url.hostname)
  if (!loopback(database) || !['postgresql:', 'postgres:'].includes(database.protocol) ||
      database.port !== '15432' || database.pathname !== '/coffee_shop_browser_test' ||
      database.username !== 'coffee_browser_test' || database.searchParams.get('schema') !== 'public' ||
      !loopback(redis) || redis.protocol !== 'redis:' || redis.port !== '16379' || !['', '/', '/0'].includes(redis.pathname)) return reject()
  return {
    NODE_ENV: 'test',
    DATABASE_URL: database.toString(),
    REDIS_URL: redis.toString(),
    HOST: '127.0.0.1', PORT: '8889', APP_PREFIX: '/api/v1',
    FE_URL: 'http://localhost:4174', PASSWORD_RESET_URL: 'http://localhost:4174/reset-password',
    API_PROXY_TARGET: 'http://127.0.0.1:8889',
    JWT_SECRET: 'browser-test-access-secret-not-for-production',
    JWT_REFRESH_SECRET: 'browser-test-refresh-secret-not-for-production',
    CSRF_ENABLED: 'true', COOKIE_SECURE: 'false', COOKIE_SAME_SITE: 'strict',
    AUTH_SIGNUP_ENABLED: 'false', SWAGGER_ENABLED: 'false',
    GOOGLE_CLIENT_ID: '', TURNSTILE_SECRET_KEY: '',
    TELEGRAM_BOT_TOKEN: '', TELEGRAM_BOT_USERNAME: '', TELEGRAM_WEBHOOK_SECRET: '',
    OUTBOX_POLL_INTERVAL_MS: '0', OTEL_ENABLED: 'false',
    // Contract tests share one IP; rate-limit behavior has a separate Redis e2e suite.
    THROTTLE_LIMIT: '1000', THROTTLE_TTL: '60000',
    VNPAY_TMN_CODE: 'BROWSERTEST', VNPAY_HASH_SECRET: 'browser-test-vnpay-secret-never-a-merchant-key',
    VNPAY_RETURN_URL: 'http://localhost:4174/payment/vnpay/return',
    MOMO_PARTNER_CODE: 'BROWSERTEST', MOMO_ACCESS_KEY: 'browser-test-momo-access',
    MOMO_SECRET_KEY: 'browser-test-momo-secret-never-a-merchant-key',
    MOMO_REDIRECT_URL: 'http://localhost:4174/payment/momo/return',
    MOMO_IPN_URL: 'http://127.0.0.1:8889/api/v1/payments/momo/ipn',
    VITE_TURNSTILE_SITE_KEY: '', VITE_GOOGLE_CLIENT_ID: '',
  }
}
