import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Megaphone, RefreshCw } from 'lucide-react'
import { Button, Dialog, DialogTitle } from '@/shared/ui'
import { errorMessage } from '@/shared/api/client'
import { formatDateTime, formatPrice } from '@/shared/lib/format'
import { PromotionDetail } from './promotion-modals'
import { updatePromotionStorefront, type Promotion } from '../promotions.api'

export function PromotionPublicationModal(props: {
  employeeId: string
  promotionId: string
  onClose: () => void
  onSettled: () => void
}) {
  return (
    <PromotionDetail {...props}>
      {(promotion, reload) => (
        <PublicationForm
          key={promotion.updatedAt}
          promotion={promotion}
          onReload={reload}
          {...props}
        />
      )}
    </PromotionDetail>
  )
}

function PublicationForm({
  promotion,
  onClose,
  onSettled,
  onReload,
}: {
  promotion: Promotion
  onClose: () => void
  onSettled: () => void
  onReload: () => void
}) {
  const { t } = useTranslation()
  const flight = useRef(false)
  const [published, setPublished] = useState(promotion.showOnStorefront)
  const [description, setDescription] = useState(promotion.storefrontDescription ?? '')
  const mutation = useMutation({
    mutationFn: () =>
      updatePromotionStorefront(promotion.id, {
        showOnStorefront: published,
        storefrontDescription: description.trim() || null,
        expectedUpdatedAt: promotion.updatedAt,
      }),
    onSuccess: () => {
      onSettled()
      onClose()
    },
  })
  const expired = promotion.status === 'EXPIRED'
  return (
    <Dialog
      open
      onClose={() => {
        if (!flight.current) onClose()
      }}
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (flight.current || mutation.isError || promotion.deletedAt) return
          flight.current = true
          try {
            await mutation.mutateAsync()
          } catch {
            /* Keep the draft; reload before retrying an uncertain write. */
          } finally {
            flight.current = false
          }
        }}
      >
        <DialogTitle>{t('offer.publicationTitle')}</DialogTitle>
        <p className="break-words font-semibold">{promotion.name}</p>
        <p className="text-sm">
          {promotion.discountType === 'PERCENTAGE'
            ? `${promotion.discountValue}%`
            : formatPrice(promotion.discountValue)}
          {promotion.maxDiscount &&
            ` · ${t('offer.max', { value: formatPrice(promotion.maxDiscount) })}`}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(promotion.startDate)} – {formatDateTime(promotion.endDate)}
        </p>
        <p className="text-sm text-muted-foreground">{t('offer.counterOnly')}</p>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={published}
            disabled={mutation.isPending || !!promotion.deletedAt}
            onChange={(event) => setPublished(event.target.checked)}
          />
          {t('offer.publish')}
        </label>
        <label className="block space-y-2 text-sm">
          <span>{t('offer.description')}</span>
          <textarea
            className="w-full rounded-md border border-input bg-card p-3 focus-visible:outline-primary"
            rows={3}
            maxLength={500}
            value={description}
            disabled={mutation.isPending || !!promotion.deletedAt}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {(expired || promotion.deletedAt) && (
          <p role="status" className="text-sm">
            {t('offer.expiredPublication')}
          </p>
        )}
        {mutation.isError && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{errorMessage(mutation.error)}</p>
            <Button type="button" variant="outline" onClick={onReload}>
              <RefreshCw size={16} aria-hidden="true" />
              {t('offer.reload')}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
            {t('offer.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={
              mutation.isPending ||
              mutation.isError ||
              !!promotion.deletedAt ||
              (published && expired)
            }
          >
            <Megaphone size={16} aria-hidden="true" />
            {mutation.isPending ? t('offer.saving') : t('offer.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
