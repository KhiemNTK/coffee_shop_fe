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
  return (
    <Card className="lg:col-span-7 p-5">
      <CardContent className="p-0">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <Coffee className="h-5 w-5 text-primary" /> Chọn món
        </h2>

        {/* Ô tìm kiếm & lọc danh mục */}
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Tìm món nhanh…"
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
            <option value="">Tất cả danh mục</option>
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
          <div role="alert">
            <p>{error}</p>
            <Button variant="outline" onClick={onRetry}>
              Thử lại
            </Button>
          </div>
        ) : isLoadingMenu ? (
          <p
            className="py-8 text-center text-sm text-muted-foreground animate-pulse"
            role="status"
          >
            Đang tải món…
          </p>
        ) : menuItems?.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Không tìm thấy món phù hợp.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {menuItems?.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item)}
                disabled={disabled}
                className="group flex min-h-[85px] flex-col justify-between rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-xs focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 select-none cursor-pointer"
              >
                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {item.name}
                </span>
                <span className="mt-2 text-xs font-bold text-primary">
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
