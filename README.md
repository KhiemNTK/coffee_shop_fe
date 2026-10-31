# Coffee Shop Frontend

## Customer Wishlist

`/wishlist` supports Google customer sign-in and server-backed favorites shared
across devices. The public menu and product dialog use the same favorite button;
staff authentication remains separate. Apply backend migration
`20261013000000_customer_wishlist` before enabling this UI. Set the existing
`VITE_GOOGLE_CLIENT_ID` and `VITE_TURNSTILE_SITE_KEY` to match backend configuration.
No Google secret, customer session token or wishlist snapshot is stored in browser
storage. Customer mutations send the separate `customerCsrfToken` cookie as
`X-CSRF-Token`, never retry employee refresh, and include `expectedCustomerId` to
reject an account changed in another tab. Uncertain save/remove retries preserve
the original PUT/DELETE intent instead of toggling from a stale UI snapshot.

Favorites show current backend prices and availability. Discontinued items remain
removable; unavailable items cannot be added to the cart. Private queries are scoped
by customer ID and discarded on login/logout; ordinary checkout still revalidates
prices and availability on the server. Google customer registration does not grant
staff roles or permissions. Password-based customer auth and loyalty are not part
of this slice.

## Cloudflare And Order Recovery

Deploy backend migration `20261024000000_allow_asap_order_no_show` and the matching
`/online-orders/requests/recover-by-key` and `/customers/orders/recover-by-key`
routes before this frontend. Reloaded checkout/reorder blocks new intents while
an earlier write is unknown. Its tab-scoped proof and frozen basket do not store
recipient name, phone or CAPTCHA. A read-only recovery can run while intake is
paused; only a missing result enables explicit same-key resend with matching
re-entered contacts and fresh CAPTCHA. The customer account must match; a guest
intent is never transferred into a signed-in customer's history.

Online sessions use the online collection screen, not generic POS checkout or
per-line cancellation. Accepted pending items display awaiting preparation.
Private pickup QR supports keyboard scanners and compatible browser cameras;
scanning never submits cash collection. Unsupported/denied cameras retain manual
entry. Camera tracks stop on close, scan, navigation, backgrounding or timeout.

Deploy the matching backend's read-only `/online-orders/requests/recover` and
`/customers/orders/recover` routes before this frontend. Checkout and reorder use
these routes after an unknown result; a lookup cannot create an order. Only an
explicit resend after `ONLINE_ORDER_RECOVERY_NOT_FOUND` uses the original create
route, unchanged payload/key and a fresh CAPTCHA. Recovery does not store recipient
name, phone or CAPTCHA, and never transfers a guest order to a customer account.

Turnstile adapts to the container width and app theme/language. WAF challenge
responses are separate from permission errors and never trigger automatic writes.
For production Caddy behind Cloudflare, configure `CADDY_TRUSTED_PROXY_CIDRS` in
the backend deployment environment, not `VITE_*`. The direct-VPS default trusts
loopback only; never trust arbitrary visitor forwarding headers.

## payOS Payments

payOS shares the existing staff invoice gateway with VNPay/MoMo. Provider availability
comes from the backend; credentials belong only in backend environment variables.
Creation and explicit link recovery keep the same payment attempt and idempotency
identity. PAYOS creation has a 25-second client budget for the bounded create/query
recovery path; ordinary reads retain their existing deadline.

`/payment/payos/return` reads the server-issued UUID/HMAC `state`, removes it from
the address bar and preserves it only in the current browser history entry for
reload. Browser `status`, `cancel`, `code` and `orderCode` do not confirm payment.
The backend's signed webhook/outbox reconciliation is authoritative.

Deploy the matching backend migration `20261012010000_add_payos_provider` before
starting the new API. Configure merchant keys and the HTTPS webhook only after
deployment; no frontend payOS SDK or secret is needed. Automatic payOS refunds and
public online-order prepayment are not implemented by this integration.

React + TypeScript SPA, maintained separately from the sibling Nest backend.
Includes public menu/reservations/takeaway ordering, staff authentication,
POS, kitchen, invoices, payments/refunds, inventory/procurement and administration.
Implementation and verification boundaries are recorded in [Integration Delivery Ledger](docs/PRODUCTION-ROADMAP.md).

## Local Development

The audit-hardening UI requires the matching backend and migration
`20261012000000_payment_link_recovery_and_retention`. Transfers/merges/clears send
the session identity observed by the operator; stale sessions return a conflict.
The payment panel reopens the existing attempt URL through an explicit protected
POST, without creating another payment. Pin CI `BACKEND_REF` to that backend
revision before running the live contract suite.

POS session opening requires the matching backend's `idempotencyKey` contract.
The actor-scoped opening intent survives reload/logout in this tab. Unknown
results resend only the original payload/key; corrupt or expired recovery data
blocks a replacement opening. Unsent draft items block checkout buttons and F2.
An online queue selection never moves to another order when polling removes it.
Refund exceptions show their refund ID and manual-reconciliation limit, not a
payment-reconciliation button; this does not add a refund-recovery API.

Checkout and reorder read public intake availability. New ASAP orders stop
outside configured shop hours; uncertain existing submissions keep their original
identity and can be checked again. KDS events coalesce refreshes over 250 ms,
with 60-second fallback polling while connected and faster polling when offline.

Use Node 24 LTS and pnpm 9.15.9. From this repo:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3001. Vite forwards `/api/v1` unchanged to
http://localhost:8888, the backend's current local port. Start the backend
separately according to its README. If its port changes, set
`API_PROXY_TARGET` in `.env.local` using `.env.example` as reference.
The frontend displays an error with retry when the backend is unavailable;
it does not substitute demo data.

Open `../coffee_shop_be/coffee-shop.code-workspace` to view both Git repos.
Agent write permissions are separate from editor folders. See `.agents/AGENTS.md`
and the canonical backend skill for cross-repo work.

## Verification

### Module Boundaries

- `app/` composes routes, providers and application startup.
- `features/<domain>/` owns API schemas, queries and workflows. Root files are
  public entry points; `components/` and `hooks/` are private to that feature.
  Other features import public entries directly, not pages or private folders.
- `shared/` contains business-independent UI and infrastructure. It must not
  import features or app code. Money validation lives in `shared/api/money.ts`;
  exact arithmetic and display live in `shared/lib/money.ts` and `format.ts`.
- Keep business components such as the storefront header in their feature.
  Do not add feature-wide barrels or duplicate a component to shorten an import.

Run `pnpm boundaries:check` and `pnpm test:architecture` before pushing.
CI checks dependency direction, private imports and runtime import cycles.
Checkout rendering and its workflow are separated into `cart-checkout-drawer.tsx`
and the feature-private `hooks/use-cart-checkout.ts`; API contracts, CAPTCHA and
same-key recovery remain unchanged.

Real-backend tests live in `tests/integration/`, grouped by business workflow.
Each test receives its own actor, catalog and funds from
`tests/fixtures/live-backend.ts`. Tests needing cash collection open their own
shift through the API; none depends on an earlier test having succeeded.
Each worker owns one Prisma Client and disconnects it at teardown; test data
remains independent without creating a new connection pool for every case.
Data stays in the guarded,
disposable test database; immutable ledgers are not deleted between tests.
Run a focused group with
`pnpm test:integration tests/integration/checkout.spec.ts --workers=1`.

Purchase receipts use server-computed totals and costing. An uncertain draft
creation freezes its original payload for an explicit same-key retry; posted
documents are read-only. Receipt posting, duplicate requests and atomic stock,
ledger, audit and outbox rollback are exercised against dedicated PostgreSQL/Redis.
Inventory quantities retain four decimal places rather than being rounded for display.

Stocktakes review saved counts and exact positive/negative/zero variances before
posting. Unknown creation outcomes retry the frozen request; unknown count saves
recover by reading the server, not blindly overwriting. Posting sends the reviewed
`expectedCounts`, and the backend rejects changed counts in the same transaction.
This field remains optional for legacy clients; those clients do not get this
review precondition. A stale stock snapshot requires cancelling the draft,
creating a new snapshot and recounting; saving counts cannot rebase it.

Catalog categories and kitchen stations use searchable, paginated native lookups;
selections survive changing pages and failed lookup reads. Item editing requires
a fresh, valid detail response and PATCHes only changed fields, with exact decimal
price strings. Unknown updates freeze the draft and recover through GET; unknown
creation does not offer a blind POST retry. Station reads require their permission.

Stock status exposes every recipe state and the actual filtered server count.
Its scope is the base recipe for one portion, excluding toppings and unprepared
orders; missing recipes or failed reads are not presented as healthy stock.
Mobile tables scroll internally without squeezing status labels or widening the page.

Menu recipes and topping ingredients share a permission-aware, searchable,
paged editor with exact four-decimal quantities. Failed or malformed reads cannot
enable destructive replacement; saving option prices preserves their ingredients.
Unknown PUT outcomes freeze editing and recover by reading saved configuration,
not by blindly submitting again. Focus/reconnect does not replace an open draft.
New orders freeze their selected recipe when created; entering COOKING consumes
stock and snapshots cost atomically. Cancelling a prepared, unpaid, uninvoiced
item records waste without restoring stock or deducting it a second time.

```powershell
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:google
```

Alternatively use installed Google Chrome on Windows:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

Playwright starts a separate Vite instance on port 4173, intercepts API responses,
and tests desktop/mobile. Both fixture modes disable the API proxy: unmocked
mutations return 404 rather than reaching the business backend. These are
browser contract-fixture tests, not a
substitute for checking the real backend. Screenshots are in `test-results/fixtures/`.
Oxlint comes from the Vite template and fails on warnings; strict TypeScript
checks both app and test code. No second lint tool is installed.

The real-backend gate uses a separate PostgreSQL/Redis pair and API/frontend
ports 8889/4174. Follow [INTEGRATION-TESTING.md](docs/INTEGRATION-TESTING.md) to run
`pnpm test:integration`; its strict typecheck runs after generating the backend
Prisma Client. It is required by the separate CI integration job and never
uses the business database. Artifacts are isolated in `test-results/backend/`.
Run the two browser suites sequentially on Windows. Current delivery results and
the backend revision required by this slice are recorded in [PRODUCTION-ROADMAP.md](docs/PRODUCTION-ROADMAP.md).
Google SDK fixtures run separately with `pnpm test:google`, also enforced by CI.
This gate never uses a real Google account; see [auth and notification acceptance](docs/AUTH-NOTIFICATION-ACCEPTANCE.md) for provider configuration and external verification.

CI runs lint, typecheck, build and the production dependency audit first. Fixture
tests run on four independent shards with one worker each; Google fixtures and
the real-backend contract have separate jobs. The final `verify` check requires
all jobs to succeed, preserving the required-check name used by branch protection.
Each browser job uploads its HTML report and available traces/screenshots.
Playwright starts Vite with `CI=true`, including local runs, so closing the
runner's stdin cannot stop the frontend server midway through a suite.
Run one shard locally with `pnpm test:e2e --shard=1/4 --workers=1`, changing the
index through `4/4` to cover the suite. Do not combine the Google suite with a
fixture runner on the same port.

## API Contract

- `GET /api/v1/menu/public/categories`: envelope `data` contains `{id, name}[]`.
- `GET /api/v1/menu/public/items`: `data` contains `list`, `totalPages`,
  `totalItems`, `currentPage`. Query: `page`, `itemPerPage`, `keyword`, `categoryId`.
- The boundary accepts safe numeric amounts or exact decimal strings, and
  normalizes to strings. Display uses BigInt, preserving received decimal
  digits. Unsafe numeric amounts are rejected, not silently rounded; the client
  cannot recover precision already lost at the server. Option prices are additive.
- Source of truth: backend `src/app/menu/menu.controller.ts`,
  `src/app/menu/menu.service.ts`, `src/app/menu/dto/`, and response interceptor.
- Recipe/options reads and replacements include the item name and ingredient
  details. Deploy the matching backend contract before pinning frontend CI.
  Insufficient cooking stock returns `INVENTORY_INSUFFICIENT_STOCK` (409).
- Zod validates the used response fields. Failed HTTP or malformed responses
  show a generic error, not raw server data. Requests normally time out after
  10 seconds; MoMo creation and manual reconciliation use 35 seconds.
- Queries have a 30-second freshness window; private query data is cleared on
  identity changes and is never persisted. Cookie auth uses CSRF and coordinated
  refresh. Mutations are not automatically retried after timeout.
- Staff session expiry keeps a validated `/staff` destination in tab-local
  sessionStorage. Password and Google login restore it once, through normal route
  permissions, without replaying writes. Explicit logout or cross-tab identity
  changes clear it. Customer login and password recovery honor `Retry-After`
  and show the backend support ID; security tokens are still discarded after use.
- Idempotent operations retain a UUID and payload digest in sessionStorage until
  a valid success response. They do not persist raw request bodies or passwords.
- Online checkout reviews the cart before submission and requests optional
  recommendations using the same `clientRequestId`. Required item options and
  exact subtotal are supported. Visible treatment offers refresh every 30 seconds
  and when returning online/focusing a stale tab, preserving their assignment.
  Control cohorts, failed offers and locked submissions do not poll. A failed
  refresh hides stale suggestions; final quotes still validate stock and prices.
  Uncertain submission locks the original payload
  for explicit retry; offer failure does not prevent ordering. Experiment reports
  count server-confirmed paid orders, not client clicks or assumed sales lift.
- Staff POS/invoices share the payment gateway panel. Provider readiness,
  callback safety and external acceptance boundaries are documented in
  [PAYMENT-ACCEPTANCE.md](docs/PAYMENT-ACCEPTANCE.md).

## Completed Staff Integration

- POS catalog and kitchen tickets preserve pagination. Saved size/topping snapshots
  are visible in POS, KDS and invoice details.
- Checkout supports whole-line invoice selection and promotions through the
  backend read-only `POST /invoices/quote`; actual payment is recalculated in its
  transaction. Uncertain cash/card and QR invoice creation keep the original intent.
- Walk-in takeaway handoff and session cancellation use dedicated confirmed commands.
  Online cancellation stays in online order management to release pickup capacity.
- Kitchen station/SLA/printer routing, inventory categories/units, custom roles,
  shift reconciliation details and full customer-feedback reports have staff screens.
- Failed or malformed role-assignment reads never turn into an empty replacement.
  System roles stay immutable; deleting a custom role explicitly warns about removal
  from all assigned employees.
- Printing tabs and reads follow each endpoint's permission, including reprint-only
  access. Device search and employee search/status/position filters run on the server
  before pagination. Equipment/settings histories paginate independently of lists;
  failed reads expose retry instead of an apparently healthy empty list.
- Staff refresh reloads the current employee/position page without discarding its
  filters. Shift history-only access does not read the current shift or funds;
  opening a shift needs current-shift/open/fund-read access in the UI. A failed
  fund read blocks submission and its retry performs only the read.
- Page-local status counts are not displayed as global KPIs. Kitchen reconnects
  reload authoritative snapshots, with sparse polling while SSE is connected.
  Uncertain receipt reprints keep their original key/body; success means queued,
  not physically printed. Printer options include every active page.
- CI requires repository variable `BACKEND_REF` to be a full committed backend SHA.
  There is no fallback to an old or mutable contract revision. Commit the backend
  changes before setting that variable and running remote integration.
  A full SHA can still point to an old contract. If adapters reject role flags or
  exception counts, compare `BACKEND_REF` with the intended backend release SHA.
  Contract test errors include missing field paths, never the raw response body.

## Deployment Boundary

`pnpm build` outputs `dist/`. Serve it behind HTTPS with a same-origin reverse
proxy for `/api/v1`; Vite's development proxy is not included in the build.
`pnpm preview` only previews static assets and does not connect the API.
Never publish server secrets in `VITE_*` variables.

React Router provides lazy routes; TanStack Query owns server state. Forms use
native controls and Zod boundary validation. No extra form/state framework is needed.

Cover image: [Unsplash coffee photo](https://images.unsplash.com/photo-1509042239860-f550ce710b93).
The cover is decorative; product names, prices and options always come from the API.

## Invoice Contract Release

Deploy the backend and its `20261024100000_invoice_document_snapshot` migration
before this frontend. POS quotes require the backend's `quoteFingerprint` field;
update the FE integration workflow's `BACKEND_REF` to the corresponding pushed
backend commit, not a commit that predates this contract.

Invoice history and printing use immutable item/table snapshots. Cash/card
checkout recovery keeps the original command in the same tab across reloads;
never collect money again while its result remains unknown. Recovery older than
23 hours requires invoice/shift reconciliation. Void and session cancellation
require an explicit reason; no sample reason is submitted automatically.
