import { getCategoryVisual } from '../featured-categories.data'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/ui/utils'

export function FeaturedCategories({
  categories,
  onSelectCategory,
}: {
  categories?: { id: string; name: string }[]
  onSelectCategory: (categoryId: string) => void
}) {
  const { t } = useTranslation()
  if (!categories || categories.length === 0) return null

  const displayCategories = categories.slice(0, 6)

  return (
    <section className="py-8 sm:py-12 bg-background border-b border-border/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              {t('storefront.featuredCategories')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('storefront.categoryDescription')}
            </p>
          </div>
          <a
            href="#menu"
            className="text-xs sm:text-sm font-bold text-primary hover:underline flex items-center gap-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            <span>{t('storefront.viewAll')}</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 sm:gap-4">
          {displayCategories.map((cat) => {
            const visual = getCategoryVisual(cat.name)
            const Icon = visual.icon

            return (
              <button
                key={cat.id}
                type="button"
                aria-label={t('storefront.exploreCategory', { name: cat.name })}
                onClick={() => onSelectCategory(cat.id)}
                className="group rounded-2xl border border-border/80 bg-card p-3.5 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md cursor-pointer flex flex-col items-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div
                  className={cn(
                    'aspect-square w-full rounded-xl flex items-center justify-center mb-2.5 transition-all duration-300 border',
                    visual.bgClass
                  )}
                >
                  <Icon
                    className={cn(
                      'size-8 transition-transform duration-300 group-hover:scale-110',
                      visual.colorClass
                    )}
                    aria-hidden="true"
                  />
                </div>

                <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {cat.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}


