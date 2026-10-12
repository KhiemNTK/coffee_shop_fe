# Vietnamese / English UI

`index.ts` owns one i18next instance. Vietnamese is bundled and is the default;
English is a dynamic import loaded before changing language. `LanguageSelector`
uses a native labelled select, prevents overlapping changes, and leaves the
current language intact when loading fails. The preference is public browser
state (`coffee_shop_language`), not an auth credential or a database field.
Blocked storage does not prevent switching in the current tab.

## Contract

- Use `useTranslation()` in React components, never translate module constants
  once at import time. Store translation keys in status maps and translate while
  rendering. Non-React display helpers use the same `i18n` instance.
- Keys are flat semantic identifiers, grouped by prefix. `en.ts` must satisfy
  `Record<keyof typeof vi, string>`; tests also verify interpolation parameters.
- Use interpolation/plurals for complete messages. Never translate item names,
  customer notes, employee names, role names or any arbitrary API data.
- React escapes display text. Do not render translations with
  `dangerouslySetInnerHTML`, and do not use a DOM/MutationObserver translator.
- API client sends `Accept-Language`. Codes, IDs, timestamps, prices, enums and
  request payloads stay canonical. Language switching does not invalidate data,
  retry mutations, reset drafts or remount routes. Existing detailed server
  errors may stay in their original language until the next explicit request.
- VND remains VND. Exact decimal/BigInt display uses locale-specific separators;
  input values and monetary arithmetic remain unchanged. The shop calendar stays
  `Asia/Ho_Chi_Minh`, regardless of the UI language or device timezone.

## Rollout Boundary

Migrated: public menu, staff authentication/navigation, POS/checkout, remote
takeaway intake/tracking, collection/reorder, public reservations, shared error
states, pagination and central date/amount helpers. Google/Turnstile widgets
receive the selected UI language.

This is not a claim of 100% bilingual coverage. Detailed inventory, employee,
settings, printing, reconciliation and reporting administration screens still
contain Vietnamese labels; they should be migrated by domain. The development
signup screen also retains legacy copy and stays disabled in production.
Backend custom business messages without a registered translation keep their
specific original reason. Audit/provider/export content is intentionally not
translated. No migration or seed is needed for this feature.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test tests/i18n.spec.ts tests/reorder-recovery.spec.ts --workers=1
```

The tests cover key/parameter parity, English lazy loading, reload persistence,
failed loading, disabled storage, exact decimals, Vietnam time and changing
language during an uncertain order without changing its idempotency payload.

References: [react-i18next](https://react.i18next.com/latest/usetranslation-hook),
[i18next resource loading](https://www.i18next.com/how-to/add-or-load-translations),
[Turnstile language configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).
