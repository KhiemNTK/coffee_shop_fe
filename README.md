# Coffee Homes Frontend

React + TypeScript SPA for one coffee shop, maintained alongside
`../coffee_shop_be`. Customers browse the menu, save favorites, request tables
and order pickup. Staff use POS, kitchen, invoices/payments, inventory, shifts,
reports and administration. PostgreSQL/backend state remains authoritative.

## Local Development

Use Node.js 24 and pnpm 9.15.9. Start the backend separately.

1. For a new checkout, copy [.env.example](.env.example) to `.env.local` without
   overwriting existing configuration.
2. Set `API_PROXY_TARGET` to the actual backend origin. The frontend defaults to
   `http://localhost:8888`, while the backend env example uses port 3000.
   Use `API_PROXY_TARGET=http://localhost:3000` for that backend configuration.
3. Run from this repository:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3001`. Vite proxies `/api/v1` without changing the prefix.
A backend outage shows an error/retry, never substitute catalog or payment data.
A busy port requires a different explicit `--port`; no port is silently selected.

| Setting                    | Meaning                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `API_PROXY_TARGET`         | Development proxy only; not production routing.                |
| `VITE_GOOGLE_CLIENT_ID`    | Public OAuth ID matching backend `GOOGLE_CLIENT_ID`.           |
| `VITE_TURNSTILE_SITE_KEY`  | Public widget key; the secret remains backend-only.            |
| `VITE_AUTH_SIGNUP_ENABLED` | Development employee bootstrap only; keep false in production. |

Restart development after changing env; rebuild production for changed `VITE_*`.
Those values are public. Never add database URLs, provider keys or JWT secrets.

## Project Structure

| Directory                      | Responsibility                                                               |
| ------------------------------ | ---------------------------------------------------------------------------- |
| [src/app/](src/app/)           | Routes, providers and startup composition                                    |
| [src/features/](src/features/) | Domain API schemas and workflows; feature root files are public entry points |
| [src/shared/](src/shared/)     | Business-independent UI and infrastructure; must not import features/app     |
| [tests/](tests/)               | Browser fixtures and separate real-backend integration groups                |
| [tools/](tools/)               | Permission synchronization and module-boundary checks                        |

Other features must not import private `components/`, `hooks/` or page internals.
React Router handles navigation; TanStack Query owns server state. Reuse existing
controls/helpers instead of adding form/state layers or feature-wide barrels.
See [localization](src/shared/i18n/README.md) and
[customer accounts](docs/customer-account.md) for those focused contracts.

## Integration Rules

- The backend controls RBAC, stock, prices, payment status and audit. Hidden
  buttons are not authorization. Customer Google sessions and staff sessions
  remain separate; no customer login grants employee access.
- Validate response fields with Zod. Money schemas live in `shared/api/money.ts`;
  calculations/display preserve exact decimal strings. Unsafe numeric amounts
  cannot be repaired by client rounding.
- Cookie mutations use CSRF. Private queries are scoped/cleared on identity
  changes, not persisted as an offline cache. New mutations are not automatically
  replayed after timeout or a Cloudflare challenge.
- Keep the original pending command/key after an uncertain write. Recovery reads
  do not create orders or confirm payments; do not switch accounts/keys to retry.
- Online pickup uses payment on collection. Use the dedicated online collection
  flow, not generic POS checkout. Refunds/voids require their permission and reason.
- Kitchen completion marks dine-in items `READY`; staff confirm table delivery
  from POS using the handoff permission. Update the matching backend before this
  frontend in the same release. Unreadable POS recovery data locks writes without
  deleting the pending command; use invoice/order records for staff review.
- Invoice documents preserve issued snapshots. Browser payment return parameters
  are not proof of payment; use verified server status.
- Reconciliation separates the original payment from a partial refund. Manual
  refund verification requires another authorized employee and provider evidence.
  Bank import supports mapped `.xlsx` previews, not an assumed MBBank layout;
  it matches cash-handover deposits, not all revenue or provider settlements.
- Role edits load fresh metadata and send `expectedUpdatedAt`; conflicts require
  review. Unsaved role/permission drafts ask before discard. System roles are
  protected; an in-use custom role must be reassigned before deletion.
- Reservation requests await store approval. Time-window table lookup is advisory
  until saving; the staff queue refreshes every 20 seconds while visible.
- A print acknowledgement means queued, not physically printed. Hardware printing
  needs a compatible external agent/device and separate acceptance.

## Verification

Run lightweight gates first:

```powershell
pnpm permissions:check
pnpm boundaries:check
pnpm test:architecture
pnpm lint
pnpm typecheck
pnpm build
```

Permission synchronization reads the sibling backend. Use `permissions:sync` only
after reviewing a backend contract change, then commit the generated contract.

Browser fixtures need Playwright Chromium; run suites sequentially, with one worker:

```powershell
pnpm exec playwright install chromium
pnpm test:e2e --workers=1
pnpm test:google --workers=1
```

Fixtures run desktop/mobile against a separate Vite instance on 4173; their modes
disable the API proxy. Unmocked writes cannot reach the shop backend.
They are not real-backend or real Google/payment-provider acceptance.
For a smaller run, pass a test file or use `--shard=1/4`.

### Real Backend Tests

Use separate disposable PostgreSQL/Redis, not normal development/shop services.
The guards in [backend-environment.ts](tests/backend-environment.ts) require:

```powershell
$env:NODE_ENV = 'test'
$env:BROWSER_TEST_DATABASE_URL = 'postgresql://coffee_browser_test:coffee_browser_test@127.0.0.1:15432/coffee_shop_browser_test?schema=public'
$env:BROWSER_TEST_REDIS_URL = 'redis://127.0.0.1:16379/0'
pnpm test:integration tests/integration/checkout.spec.ts --workers=1
```

Create those isolated services with matching test credentials first. The harness
validates targets, generates Prisma, applies migrations to the test database and
builds the sibling backend. API/frontend ports are 8889/4174. Tests receive isolated
actors/catalog/funds and open their own cashier shifts; none relies on prior tests.

CI has separate quality, four one-worker browser shards, Google and real-backend
jobs. The final `verify` gate requires all of them. `BACKEND_REF` is a GitHub Actions
repository variable containing the compatible pushed backend commit's full SHA,
not a frontend env variable. Obtain it after committing/pushing the backend:

```powershell
git -C ../coffee_shop_be rev-parse HEAD
```

Update the variable when the backend contract used by FE changes. A SHA alone does
not prove compatibility. Traces/screenshots are under `test-results/fixtures/`,
`test-results/google/` and `test-results/backend/`.

## Production Deployment

`pnpm build` outputs `dist/`. Serve it through HTTPS with SPA history fallback
and a same-origin `/api/v1` reverse proxy. Vite's dev proxy is not in that bundle;
`pnpm preview` is not an application production server.

The non-root [Dockerfile](Dockerfile) and [Caddyfile](Caddyfile) are used by the
backend's `deploy/compose.production.yml`. Follow that repository's
`deploy/README.md` for releases and backup/recovery. Deploy migrations/matching
backend before frontend contract changes and verify provider callbacks through
the public hostname. Fixtures do not prove live payments or physical printing.
