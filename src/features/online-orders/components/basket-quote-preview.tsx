import { formatPrice } from '@/shared/lib/format'
import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { quoteOnlineOrder, type PublicOrderItemPayload } from '../online-orders.api'

export function BasketQuotePreview({ items }: { items: PublicOrderItemPayload[] }) {
  const { t } = useTranslation()
  const lastFetchAt = useRef(0)
  // Notes and contact fields do not affect price or stock and must not trigger requests.
  const basketKey = JSON.stringify(
    items.map(({ menuItemId, quantity, optionIds }) => ({ menuItemId, quantity, optionIds })),
  )
  const quote = useQuery({
    queryKey: ['online-basket-preview', basketKey],
    enabled: items.length > 0,
    retry: false,
    gcTime: 0,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      await new Promise<void>((resolve, reject) => {
        // Bound preview traffic below the existing 30/min limit; keep room for final checks.
        const timer = window.setTimeout(
          () => {
            signal.removeEventListener('abort', abort)
            resolve()
          },
          Math.max(600, 2500 - (Date.now() - lastFetchAt.current)),
        )
        function abort() {
          window.clearTimeout(timer)
          reject(signal.reason)
        }
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      })
      lastFetchAt.current = Date.now()
      return quoteOnlineOrder(JSON.parse(basketKey) as PublicOrderItemPayload[], signal)
    },
  })
  if (!items.length) return null
  return (
    <div role="status" aria-live="polite" className="border-t border-border pt-3 text-sm">
      {quote.isPending
        ? t('takeaway.previewChecking')
        : quote.isError
          ? t('takeaway.previewUnavailable')
          : !quote.data.canFulfill
            ? t('takeaway.previewInsufficient')
            : t('takeaway.previewReady', { total: formatPrice(quote.data.subtotal) })}
    </div>
  )
}
