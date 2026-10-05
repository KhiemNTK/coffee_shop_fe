# Coffee Shop Frontend

React + TypeScript SPA, maintained separately from the sibling Nest backend.
Includes public menu/reservations/takeaway ordering, staff authentication,
POS, kitchen, invoices, payments/refunds, inventory/procurement and administration.
Implementation and verification boundaries are recorded in [Integration Delivery Ledger](docs/PRODUCTION-ROADMAP.md).

## Local Development

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
- Idempotent operations retain a UUID and payload digest in sessionStorage until
  a valid success response. They do not persist raw request bodies or passwords.
- Online checkout reviews the cart before submission and requests optional
  recommendations using the same `clientRequestId`. Required item options and
  exact subtotal are supported. Uncertain submission locks the original payload
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

## Deployment Boundary

`pnpm build` outputs `dist/`. Serve it behind HTTPS with a same-origin reverse
proxy for `/api/v1`; Vite's development proxy is not included in the build.
`pnpm preview` only previews static assets and does not connect the API.
Never publish server secrets in `VITE_*` variables.

React Router provides lazy routes; TanStack Query owns server state. Forms use
native controls and Zod boundary validation. No extra form/state framework is needed.

Cover image: [Unsplash coffee photo](https://images.unsplash.com/photo-1509042239860-f550ce710b93).
The cover is decorative; product names, prices and options always come from the API.
