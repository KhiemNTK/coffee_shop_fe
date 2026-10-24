import { useTranslation } from 'react-i18next'
import {
  CakeSlice,
  Coffee,
  CupSoda,
  LayoutGrid,
  Leaf,
  Package,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/shared/ui/utils'

const categoryIcons: Record<string, typeof Coffee> = {
  'cà phê': Coffee,
  'trà': CupSoda,
  'trà sữa': CupSoda,
  'trà trái cây': Leaf,
  matcha: Sparkles,
  'bánh ngọt': CakeSlice,
  combo: Package,
  'đồ uống lạnh': CupSoda,
  'món đặc biệt': Sparkles,
}

export function MenuCatalogSidebar({
  categories,
  activeCategoryId,
  totalItems,
  onSelectCategory,
}: {
  categories?: { id: string; name: string }[]
  activeCategoryId: string
  totalItems?: number
  onSelectCategory: (categoryId: string) => void
}) {
  const { t: translate } = useTranslation()

  return (
    <aside className="lg:col-span-3 xl:col-span-3 space-y-4">
      <div className="rounded-[16px] border border-border/80 bg-card p-4 shadow-xs sticky top-20 space-y-5">
        {/* Category Filter list */}
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground px-1 block mb-2">
            {translate('menu.categoryNav')}
          </span>

          <nav className="space-y-1" aria-label={translate('menu.categoryNav')}>
            {/* Tất cả món */}
            <button
              type="button"
              aria-pressed={!activeCategoryId}
              onClick={() => onSelectCategory('')}
              className={cn(
                'w-full flex items-center justify-between rounded-[10px] px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer text-left',
                !activeCategoryId
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-foreground hover:bg-muted/70',
              )}
            >
              <div className="flex items-center gap-2.5">
                <LayoutGrid className="h-4 w-4 shrink-0" />
                <span>{translate('common.all')}</span>
              </div>
              {totalItems !== undefined && !activeCategoryId && (
                <span className="text-[11px] opacity-80">({totalItems})</span>
              )}
            </button>

            {/* Categories from Backend */}
            {categories?.map((cat) => {
              const IconComp = categoryIcons[cat.name.toLowerCase()] || Coffee
              const isActive = activeCategoryId === cat.id

              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelectCategory(cat.id)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-[10px] px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer text-left',
                    isActive
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-foreground hover:bg-muted/70',
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <IconComp className="h-4 w-4 shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </div>
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}

