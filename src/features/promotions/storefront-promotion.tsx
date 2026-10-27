import { useEffect, useState } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Tag, X } from 'lucide-react'
import { Button, Dialog, DialogTitle } from '@/shared/ui'
import { formatDateTime, formatPrice } from '@/shared/lib/format'
import { displayLocale } from '@/shared/i18n'
import {
  getStorefrontPromotion,
  storefrontPromotionKey,
  type StorefrontPromotionRecord,
} from './storefront-promotion.api'

const storageKey = 'coffee-shop:storefront-promotion:last-shown'
const cooldown = 24 * 60 * 60 * 1_000
let lastShownInTab = 0

function recentlyShown() {
  let last = lastShownInTab
  try {
    last = Math.max(last, Number(localStorage.getItem(storageKey)) || 0)
  } catch {
    /* Use tab memory. */
  }
  return Number.isFinite(last) && last <= Date.now() && Date.now() - last < cooldown
}

function rememberDisplay() {
  lastShownInTab = Date.now()
  // shortcut: frequency is browser-local; add server preferences only if cross-device suppression is needed.
  try {
    localStorage.setItem(storageKey, String(lastShownInTab))
  } catch {
    /* Suppress repeats in this tab. */
  }
}

function canInterrupt() {
  return (
    !document.hidden &&
    !document.querySelector('dialog[open]') &&
    !document.activeElement?.closest('input, textarea, select, [contenteditable="true"]')
  )
}

export function StorefrontPromotion() {
  const query = useQuery({
    queryKey: storefrontPromotionKey,
    queryFn: ({ signal }) => getStorefrontPromotion(signal),
    retry: false,
    staleTime: 15_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const promotion = query.isError ? null : query.data?.promotion
  if (
    !promotion ||
    new Date(promotion.startDate).getTime() > query.dataUpdatedAt ||
    new Date(promotion.endDate).getTime() <= query.dataUpdatedAt
  )
    return null
  return (
    <StorefrontOffer
      key={`${promotion.id}:${promotion.endDate}`}
      promotion={promotion}
      query={query}
    />
  )
}

function StorefrontOffer({
  promotion,
  query,
}: {
  promotion: StorefrontPromotionRecord
  query: UseQueryResult<Awaited<ReturnType<typeof getStorefrontPromotion>>>
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [expired, setExpired] = useState(false)
  const { refetch, isFetching } = query

  useEffect(() => {
    let timer: number
    function checkExpiry() {
      const remaining = new Date(promotion.endDate).getTime() - Date.now()
      if (remaining <= 0) {
        setExpired(true)
        setOpen(false)
      } else timer = window.setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647))
    }
    timer = window.setTimeout(
      checkExpiry,
      Math.max(0, Math.min(new Date(promotion.endDate).getTime() - Date.now(), 2_147_483_647)),
    )
    return () => window.clearTimeout(timer)
  }, [promotion.endDate])

  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => {
      void refetch()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [open, refetch])

  useEffect(() => {
    if (expired || isFetching || recentlyShown()) return
    const timer = window.setTimeout(() => {
      if (recentlyShown() || !canInterrupt()) return
      rememberDisplay()
      setOpen(true)
    }, 3_000)
    return () => window.clearTimeout(timer)
  }, [expired, isFetching])

  if (expired) return null
  const discount =
    promotion.discountType === 'PERCENTAGE'
      ? `${new Intl.NumberFormat(displayLocale(), { maximumFractionDigits: 2 }).format(Number(promotion.discountValue))}%`
      : formatPrice(promotion.discountValue)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        aria-disabled={isFetching}
        onClick={async () => {
          if (isFetching) return
          const result = await refetch()
          const current = result.data?.promotion
          if (
            !result.isError &&
            current &&
            current.id === promotion.id &&
            current.endDate === promotion.endDate &&
            new Date(current.endDate).getTime() > Date.now() &&
            canInterrupt()
          ) {
            rememberDisplay()
            setOpen(true)
          }
        }}
      >
        <Tag size={16} aria-hidden="true" />
        {t('offer.reopen')}
      </Button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          showCloseButton={false}
          className="p-0"
          maxWidth="sm"
          label={t('offer.title')}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-card px-3 py-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tag size={16} aria-hidden="true" />
              {t('offer.title')}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('offer.close')}
              className="inline-flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-foreground"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <img
            src="/hero-coffee-640.webp"
            alt=""
            width={640}
            height={360}
            className="h-36 w-full object-cover"
          />
          <div className="grid gap-4 p-5 sm:p-6">
            <p className="break-words text-3xl font-bold text-foreground">
              {t('offer.discount', { value: discount })}
            </p>
            <DialogTitle className="break-words text-xl">{promotion.name}</DialogTitle>
            {promotion.storefrontDescription && (
              <p className="whitespace-pre-line break-words text-sm text-foreground">
                {promotion.storefrontDescription}
              </p>
            )}
            {promotion.maxDiscount && (
              <p className="text-sm">
                {t('offer.max', { value: formatPrice(promotion.maxDiscount) })}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t('offer.until', { date: formatDateTime(promotion.endDate) })}
            </p>
            <p className="border-t border-border pt-4 text-sm text-muted-foreground">
              {t('offer.counterOnly')}
            </p>
            <Button
              className="w-full min-h-11"
              onClick={() => {
                setOpen(false)
                navigate('/menu')
              }}
            >
              {t('offer.menu')}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
