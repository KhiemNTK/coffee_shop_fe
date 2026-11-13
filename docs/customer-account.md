# Customer Account Flow

## Entry Points

- The storefront account button opens `/customer/sign-in` for guests and `/account`
  after customer sign-in. Employee authentication stays at `/sign-in` and `/staff`.
- The two sessions are independent, even in the same browser. Opening the customer
  website in a new tab keeps the current customer account; it is not anonymous
  browsing. The storefront shows the customer email, while the staff header shows
  the employee username and roles. Each sign-out button names the session it ends.
- Customer sign-out does not sign out staff, and staff sign-out preserves customer
  data while clearing staff caches across tabs. Staff must sign out of the staff
  area before leaving a shared device; use separate browser profiles when needed.
- First Google sign-in creates a Customer identified by the verified Google
  subject. It does not create an Employee or grant staff/admin permissions.
  Public employee signup remains disabled; staff first sign in with their issued
  password and explicitly link Google from `/staff/account`.
- Wishlist uses the same customer sign-in component. Clicking a favorite while
  signed out keeps the item ID and an allowlisted return path in router state.
  Successful sign-in saves that item with the authenticated customer ID, then
  returns to the original page. A failed save is shown rather than treated as success.
- `/account` lists account-owned orders with pagination. `/account/orders/:id`
  shows history, preparation state and invoice summaries. Reordering uses
  `/account/orders/:id/reorder`; current prices and availability are checked again.
  Historical guest orders are not claimed automatically.
- `/account/vouchers` lists the customer's wallet and public campaigns. Claims
  use the signed-in identity; the wallet is never stored in localStorage. An
  expired, used, revoked or reserved voucher stays visible with its actual state.

## Checkout And Privacy

- `/cart`, the menu drawer and the takeaway screen share one checkout component.
  Only the supported takeaway/cash-on-pickup workflow is offered. No packaging
  charge or delivery promise is invented by the client.
- Signed-in submissions use `/customers/orders`, customer CSRF and
  `expectedCustomerId`. Guests retain `/online-orders/requests`. The reviewed
  account, request key and payload cannot silently change during a retry.
- If the same guest submission is still uncertain, signing in cannot create it
  again through the customer endpoint. Resolve the existing submission first.
- Signed-in orders return to account history. Their public tracking credentials
  are not stored in browser storage. Guest tracking keeps its existing recovery
  mechanism. Customer logout clears customer-owned query data, not staff sessions.
- Customer reads include `customerId`; adapters reject a response for another
  account before caching it. Deploy the matching backend before this frontend.
- Selecting a voucher uses `/customers/orders/quote`; the confirmed discount,
  total and fingerprint stay in the original pending order command. Invalid
  vouchers block submission instead of silently charging the full amount.
  History, collection and invoice documents use the saved net total. Reordering
  copies the basket only, never the previous voucher. Refunds do not restore it.

## Configuration

- Frontend: `VITE_GOOGLE_CLIENT_ID` and `VITE_TURNSTILE_SITE_KEY` are public IDs.
- Backend: `GOOGLE_CLIENT_ID` must match the frontend client ID;
  `TURNSTILE_SECRET_KEY` stays server-side. `FE_URL` supplies allowed hostnames.
- Vite values are build-time configuration: restart development or rebuild the
  production frontend after changing them. Do not put backend secrets in `VITE_*`.
- Without Google configuration, the customer page explicitly reports that login
  is unavailable while guest browsing/ordering remains available. Production
  customer login also requires Turnstile configuration; there is no staff fallback.
- Keep frontend and API same-origin through `/api/v1` so the browser can read the
  customer CSRF cookie while the session cookie remains HttpOnly.
- Google transport/configuration failures return `503 GOOGLE_UNAVAILABLE`, not a
  credentials rejection. Staff linking has localized `GOOGLE_EMAIL_MISMATCH`,
  `GOOGLE_ALREADY_LINKED` and `GOOGLE_LINK_CHANGED` errors. Retry is explicit and
  needs a fresh CAPTCHA where required; credentials are not persisted or replayed.

## Focused Verification

Run browser tests with one worker; intercepted provider/API fixtures are not a
real Google/Turnstile or business-database verification.

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright test tests/customer-journey.spec.ts tests/customer-wishlist.spec.ts tests/reorder-recovery.spec.ts --workers=1
pnpm exec playwright test --config playwright.google.config.ts tests/customer-google.spec.ts --workers=1
```
