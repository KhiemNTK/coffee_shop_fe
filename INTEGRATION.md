# Frontend / Backend Integration

## Architecture

React SPA with TypeScript, React Router, TanStack Query, Tailwind and Zod.
The Nest backend remains authoritative for prices, availability, permissions,
inventory, checkout, refunds and concurrency. No business rule engine or
duplicate financial ledger is added to the frontend.

All HTTP calls use the same-origin `/api/v1` prefix and backend success envelope.
Identity uses HttpOnly cookies, double-submit CSRF and coordinated refresh.
No access/refresh JWT is stored in localStorage or query cache.
Identity changes abort outstanding private requests and clear query data.

## Implemented Flows

| Area | Frontend integration |
| --- | --- |
| Auth | Staff sign-in/logout, permission-gated routes, password recovery/reset, Google sign-in and account linking/unlinking |
| Public | Menu/options, reservation requests, takeaway ordering/tracking, pickup slots, long-lived reorder quotes/keys |
| POS | Sessions, table transfer, order items, cash/card checkout, VNPay/MoMo payment attempts and server-confirmed status |
| Invoices | Takeaway sessions with nullable table, snapshot prices, attempt history/reconciliation, VNPay refund requests/history |
| Inventory | Stock operations, suppliers, draft purchase receipts, posting/cancellation, stocktakes/counts/posting |
| Staff | Kitchen, promotions, cashier shifts/funds/expenses/handovers, employees/positions/roles, printing, settings/equipment, audit logs |
| Reports | Financial dashboard, kitchen SLA/bottlenecks, daily sales close and export |

This table describes integrated UI flows, not proof that every backend endpoint
or every business scenario has an end-to-end browser test.

## Recovery And Safety

- Invoice rows use `priceAtTime`, not the current catalog price.
- Critical idempotent writes keep a payload digest + UUID in sessionStorage
  across explicit retries/reloads. CAPTCHA renewal is excluded from the digest.
- An uncertain network or schema outcome does not discard the UUID. The client
  never retries such mutations automatically. Retry uses the same logical payload.
- Session expiry clears private query data but preserves uncertain operation keys.
  Confirmed staff logout clears private keys, not pending public orders.
- This recovery is tab-scoped. It is not offline POS or cross-device recovery.
- Public reorder keys are explicitly issued by the server. Private links use a
  URL fragment; availability/options/prices are re-quoted before creating an order.
- Payment return pages only inspect signed results. URL result codes never mark
  an invoice paid. Payment confirmation comes from backend state/IPN.
- QR rendering is local; gateway URLs are not sent to an external QR service.
- Refund requests require permission, amount, reason and confirmation. Only
  VNPay refunds are exposed because the current backend refund adapter is VNPay-only.
- Dialogs use the native modal API with inert background, Escape and focus return.
  Staff content can shrink inside flex layouts; wide tables scroll inside their region.
- Report errors are displayed. A failed daily-close read is not treated as a
  missing close record unless the backend explicitly returns 404.

## Verification

`tests/production-flows.spec.ts` covers uncertain writes/reloads, CAPTCHA renewal,
snapshot invoice prices, modal keyboard behavior, payment return trust boundaries,
reset token handling and unavailable reorder selections.

`tests/live-backend.spec.ts` exercises 46 actual frontend read adapters against
the running local backend/PostgreSQL/Redis and renders a real takeaway invoice on
desktop/mobile. It creates isolated UUID fixtures and deletes only those records.
It refuses a production environment or non-local database. It does not disable
immutable audit triggers, post stock movements or move real money.

```powershell
pnpm lint
pnpm typecheck
pnpm build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm test:e2e --workers=2

# Opt-in: sibling backend + its local Docker database must already be running.
$env:RUN_LIVE_BACKEND = 'true'
pnpm exec playwright test tests/live-backend.spec.ts --workers=1
Remove-Item Env:RUN_LIVE_BACKEND
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

CI runs lint, strict TypeScript, production build and desktop/mobile fixture tests.
The opt-in Docker test is not silently represented as a CI integration test.
Provider scripts are not a substitute for real OAuth/payment sandbox verification.

## Deployment Requirements

Serve `dist/` over HTTPS with SPA fallback for client routes. Reverse-proxy
`/api/v1` to the backend under the same origin; Vite proxy configuration is
development-only. Do not deploy the Vite dev server as a production service.
Keep `index.html` revalidated and cache hashed assets immutably.

Configure CORS, secure cookies, reset URL and gateway return URLs on the backend
for the deployed frontend origin. Return URLs must use
`/payment/vnpay/return` or `/payment/momo/return` as appropriate.

Only public identifiers belong in frontend environment variables:

- `VITE_GOOGLE_CLIENT_ID`: must match the backend Google client ID and approved origins.
- `VITE_TURNSTILE_SITE_KEY`: must match the backend secret/domain/action configuration.
- `VITE_AUTH_SIGNUP_ENABLED`: dev-only opt-in; signup is hidden in production.

No provider secrets, database URLs or JWT secrets may be placed in `VITE_*`.
Production public forms fail closed when required CAPTCHA configuration is absent.

## Remaining Release Gates

- Configure Google/Turnstile credentials and verify with actual provider accounts.
- Verify VNPay/MoMo create, signed callbacks, expiration and reconciliation in
  the merchant sandbox. Never validate payment by manually forcing PAID on live data.
- Run controlled transaction-critical backend integration/race tests against
  dedicated test infrastructure; the live adapter test is not a race/load test.
- Verify real printer agents, Telegram notifications and merchant refund behavior.
- Rehearse deployment under the actual domain, TLS/reverse proxy and least-privilege staff roles.
- Profile representative production data before setting performance or load guarantees.

No database schema migration is required by these frontend changes.
