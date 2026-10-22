import { useTranslation } from 'react-i18next'
import { Coffee, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../../shared/ui/button'
import { Card, CardContent } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { formatPrice, type MenuItem } from '../../menu/menu.api'
import { PosRecommendationsStrip } from './pos-recommendations-strip'

interface CategoryOption {
  id: string
  name: string
}

interface PosMenuCatalogProps {
  keyword: string
  onKeywordChange: (keyword: string) => void
  selectedCategoryId: string
  onSelectCategory: (categoryId: string) => void
  categories?: CategoryOption[]
  menuItems?: MenuItem[]
  recommendations?: MenuItem[]
  isLoadingMenu: boolean
  onSelectItem: (item: MenuItem) => void
  disabled?: boolean
  pagination?: ReactNode
  error?: string | null
  onRetry?: () => void
}

export function PosMenuCatalog({
  keyword,
  onKeywordChange,
  selectedCategoryId,
  onSelectCategory,
  categories,
  menuItems,
  recommendations,
  isLoadingMenu,
  onSelectItem,
  disabled = false,
  pagination,
  error,
  onRetry,
}: PosMenuCatalogProps) {
  const { t: translate } = useTranslation()
  return (
    <Card className="lg:col-span-7 p-5">
      <CardContent className="p-0">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <Coffee className="h-5 w-5 text-primary" /> {translate('menu.chooseItem')}
        </h2>

        {/* Ô tìm kiếm & lọc danh mục */}
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={translate('menu.searchQuick')}
              aria-label={translate('menu.searchQuick')}
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={selectedCategoryId}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="">{translate('menu.allCategories')}</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Khay gợi ý món gọi kèm thông minh */}
        <PosRecommendationsStrip
          recommendations={recommendations}
          onSelectItem={onSelectItem}
          disabled={disabled}
        />

        {/* Lưới món ăn */}
        {error ? (
          <div
            role="alert"
            className="my-4 rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-center text-sm text-destructive"
          >
            <p className="font-semibold">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-3">
              {translate('common.retry')}
            </Button>
          </div>
        ) : isLoadingMenu ? (
          <p className="py-8 text-center text-sm text-muted-foreground animate-pulse" role="status">
            {translate('menu.loadingItems')}
          </p>
        ) : menuItems?.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {translate('menu.noMatchesSentence')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {menuItems?.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item)}
                disabled={disabled}
                className="group flex min-h-[85px] flex-col justify-between rounded-xl border border-border bg-card p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-xs active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 select-none cursor-pointer overflow-hidden min-w-0"
              >
                <span
                  className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 break-words w-full leading-snug"
                  title={item.name}
                >
                  {item.name}
                </span>
                <span className="mt-2 text-xs font-bold text-primary tabular-nums shrink-0">
                  {formatPrice(item.price)}
                </span>
              </button>
            ))}
          </div>
        )}
        {pagination}
      </CardContent>
    </Card>
  )
}
