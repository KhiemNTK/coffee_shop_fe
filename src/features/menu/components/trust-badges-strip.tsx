import { Clock, HeartHandshake, Leaf, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function TrustBadgesStrip() {
  const { t } = useTranslation()
  return (
    <section className="border-b border-border/80 bg-card py-6 sm:py-7 shadow-2xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="flex items-center gap-3.5 rounded-[12px] p-2.5 sm:p-3 transition-colors hover:bg-muted/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                {t('storefront.coffee')}
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                {t('storefront.preparedToOrder')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-[12px] p-2.5 sm:p-3 transition-colors hover:bg-muted/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                {t('storefront.space')}
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                {t('storefront.meetings')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-[12px] p-2.5 sm:p-3 transition-colors hover:bg-muted/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                {t('storefront.orderAhead')}
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                {t('storefront.pickupSchedule')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-[12px] p-2.5 sm:p-3 transition-colors hover:bg-muted/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
              <Zap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                {t('storefront.payAtPickup')}
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                {t('storefront.takeawayOrders')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
