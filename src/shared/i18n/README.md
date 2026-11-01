# Vietnamese And English UI

[index.ts](index.ts) owns one i18next instance. Vietnamese is bundled/default;
English loads on demand before switching. A failed load preserves the current
language. The public preference `coffee_shop_language` is not an auth credential;
blocked storage still allows switching in the current tab.

## Rules

- Call `useTranslation()` while rendering. Keep keys in status maps instead of
  translating once at module import. Non-React helpers use the same `i18n` instance.
- [locales/en.ts](locales/en.ts) must match Vietnamese keys and interpolation
  variables. Use complete messages/plurals, not concatenated translated fragments.
- Never translate arbitrary API data: item/customer/employee/role names, notes,
  IDs, enums, timestamps, prices and request bodies remain canonical.
- React escapes text. Do not use HTML injection or a DOM/MutationObserver translator.
- Switching language must not reset drafts, remount routes, invalidate business
  data or retry mutations. Existing server error text may retain its original
  language until the next explicit request.
- Use shared exact-money/date helpers. Currency remains VND; the shop calendar is
  `Asia/Ho_Chi_Minh`, regardless of UI language/device timezone.

## Scope And Verification

Shared controls, public ordering, staff auth/navigation, POS and roles/reservations
use translations. This is not a claim that every admin label is bilingual.
Custom backend errors without registered translations retain their original reason;
audit, provider signatures and exports are intentionally unchanged.

Run from the frontend root:

```powershell
pnpm typecheck
pnpm lint
pnpm exec playwright test tests/i18n.spec.ts tests/reorder-recovery.spec.ts --workers=1
```

Tests cover key/parameter parity, lazy loading/failure, storage restrictions,
exact money, Vietnam time and language changes during uncertain-order recovery.
See [the project README](../../../README.md#verification) for build/CI gates.
