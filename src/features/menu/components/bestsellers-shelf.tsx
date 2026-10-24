import type { MenuItem } from '../menu.api'
import { useTranslation } from 'react-i18next'
import { MenuCard } from './menu-card'

export function BestsellersShelf({
  items,
  onSelect,
}: {
  items: MenuItem[]
  onSelect: (item: MenuItem) => void
}) {
  const { t } = useTranslation()
  if (items.length === 0) return null

  return (
    <section id="bestsellers" className="py-8 sm:py-12 bg-card/60 border-b border-border/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
              {t('storefront.highlights')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('storefront.highlightDescription')}
            </p>
          </div>
          <a
            href="#menu"
            className="text-xs sm:text-sm font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>{t('storefront.viewAll')}</span>
            <span>&rarr;</span>
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 sm:gap-4 mt-6">
          {items.map((item) => (
            <MenuCard
              key={`bestseller-${item.id}`}
              item={item}
              onSelect={onSelect}
              isHeading={false}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
