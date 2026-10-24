import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { formatPrice, type MenuItem } from '../menu.api'
import { ProductImage } from './product-image'
import { FavoriteButton } from '@/features/customers/favorite-button'

export function MenuCard({
  item,
  onSelect,
  isBestseller = false,
  isHeading = true,
}: {
  item: MenuItem
  onSelect: (item: MenuItem) => void
  isBestseller?: boolean
  isHeading?: boolean
}) {
  const { t: translate } = useTranslation()

  return (
    <article className="h-full">
      <Card className="relative group flex flex-col justify-between overflow-hidden rounded-[14px] border border-border/80 bg-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md h-full">
        {/* 1:1 Image with badging and heart button */}
        <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
          <ProductImage
            item={item}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
            {isBestseller && (
              <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                {translate('storefront.bestseller')}
              </span>
            )}
            <Badge
              variant="secondary"
              className="w-fit max-w-full truncate text-[11px] font-semibold bg-white/95 text-primary backdrop-blur-xs shadow-2xs border border-border/60"
              title={item.category.name}
            >
              {item.category.name}
            </Badge>
          </div>
        </div>
        <FavoriteButton itemId={item.id} className="absolute right-2.5 top-2.5 z-10" />

        <CardHeader className="p-4 pb-1">
          {isHeading ? (
            <CardTitle
              className="text-base font-bold text-foreground line-clamp-1 break-words leading-snug group-hover:text-primary transition-colors"
              title={item.name}
            >
              {item.name}
            </CardTitle>
          ) : (
            <p
              className="text-base font-bold text-foreground line-clamp-1 break-words leading-snug group-hover:text-primary transition-colors"
              title={item.name}
            >
              {item.name}
            </p>
          )}

          {/* Subtitle / Description or Option Badge */}
          {item.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words leading-relaxed min-h-[2rem]">
              {item.description}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-1 min-h-[2rem] flex items-center">
              {item.optionGroups.length > 0 ? (
                <span>{translate('storefront.optionGroups', { count: item.optionGroups.length })}</span>
              ) : (
                <span>{translate('storefront.serveOptions')}</span>
              )}
            </p>
          )}
        </CardHeader>

        <CardContent className="p-4 pt-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mt-2">
            <div className="min-w-0 max-w-full">
              <span className="text-[11px] font-medium text-muted-foreground block">
                {translate('storefront.price')}
              </span>
              <p className="break-words text-lg font-bold text-primary tabular-nums">
                {formatPrice(item.price)}
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => onSelect(item)}
              className="h-9 px-3 gap-1 rounded-[10px] text-xs font-semibold shadow-xs"
              title={translate('storefront.addItem', { name: item.name })}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{translate(item.optionGroups.length > 0 ? 'storefront.customize' : 'storefront.add')}</span>
            </Button>
          </div>

          {item.optionGroups.length > 0 && (
            <details className="mt-3 rounded-[10px] border border-border/80 bg-muted/30 p-2.5 text-xs group/details">
              <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground select-none transition-colors">
                {translate('menu.optionsCount', { count: item.optionGroups.length })}
              </summary>
              <div className="mt-2 space-y-2 pt-2 border-t border-border">
                {item.optionGroups.map((group) => (
                  <div key={group.id} className="space-y-1 min-w-0">
                    <strong
                      className="block text-[11px] uppercase tracking-wider text-muted-foreground truncate"
                      title={group.name}
                    >
                      {group.name}
                    </strong>
                    <ul className="space-y-1">
                      {group.options.map((option) => (
                        <li
                          key={option.id}
                          className="flex items-baseline justify-between gap-2 min-w-0 text-muted-foreground"
                        >
                          <span
                            className="min-w-0 flex-1 break-words line-clamp-1"
                            title={option.name}
                          >
                            {option.name}
                          </span>
                          <span className="shrink-0 font-semibold text-primary tabular-nums">
                            +{formatPrice(option.priceDelta)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    </article>
  )
}
