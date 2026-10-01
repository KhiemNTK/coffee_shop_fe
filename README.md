# Coffee Shop Frontend

React + TypeScript SPA, maintained separately from the sibling Nest backend.
F0 includes a read-only public menu: server-side search, category filter,
pagination, option prices, loading/error/empty states and retry. No checkout,
authentication or POS is implemented yet.

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
Agent write permissions are separate from editor folders. See `AGENTS.md`
and the canonical backend skill for cross-repo work.

## Verification

```powershell
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Alternatively use installed Google Chrome on Windows:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

Playwright starts a separate Vite instance on port 4173, intercepts menu APIs,
and tests desktop/mobile. These are browser contract-fixture tests, not a
substitute for checking the real backend. Screenshots are in `test-results/`.
Oxlint comes from the Vite template and fails on warnings; strict TypeScript
checks both app and test code. No second lint tool is installed.

## API Contract

- `GET /api/v1/menu/public/categories`: envelope `data` contains `{id, name}[]`.
- `GET /api/v1/menu/public/items`: `data` contains `list`, `totalPages`,
  `totalItems`, `currentPage`. Query: `page`, `itemPerPage`, `keyword`, `categoryId`.
- The backend's global `DecimalInterceptor` currently emits JSON numbers.
  The boundary accepts safe numeric amounts or exact decimal strings, and
  normalizes to strings. Display uses BigInt, preserving received decimal
  digits. Unsafe numeric amounts are rejected, not silently rounded; the client
  cannot recover precision already lost at the server. Option prices are additive.
- Source of truth: backend `src/app/menu/menu.controller.ts`,
  `src/app/menu/menu.service.ts`, `src/app/menu/dto/`, and response interceptor.
- Zod validates the used response fields. Failed HTTP or malformed responses
  show a generic error, not raw server data. Requests time out after 10 seconds.
- Only public menu queries are cached (30 seconds). No private cache is persisted.
  Authentication, CSRF, single-flight refresh and mutation retry policy belong to F1.

## Deployment Boundary

`pnpm build` outputs `dist/`. Serve it behind HTTPS with a same-origin reverse
proxy for `/api/v1`; Vite's development proxy is not included in the build.
`pnpm preview` only previews static assets and does not connect the API.
Never publish server secrets in `VITE_*` variables.

React Router, Tailwind/shadcn and form libraries are deferred until F1 needs
multiple routes and authenticated forms. F0 uses native HTML and local CSS.

Cover image: [Unsplash coffee photo](https://images.unsplash.com/photo-1509042239860-f550ce710b93).
The cover is decorative; product names, prices and options always come from the API.
