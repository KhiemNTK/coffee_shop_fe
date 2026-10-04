import {
  Calendar,
  Clock,
  Edit2,
  Percent,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Ticket,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { type UseMutationResult } from '@tanstack/react-query'
import {
  type DiscountType,
  type Promotion,
  type PromotionStatus,
  type PaginatedPromotions,
} from '../promotions.api'
import { formatDateTime, formatPrice } from '../../../shared/lib/format'
import { Badge, Button, Card, CardContent, Input } from '../../../shared/ui'

function formatDiscountAmount(val: string | number) {
  return formatPrice(String(val))
}

interface PromotionsListViewProps {
  promotionsData?: PaginatedPromotions
  isLoading: boolean
  keyword: string
  onKeywordChange: (val: string) => void
  status: PromotionStatus | 'ALL'
  onStatusChange: (val: PromotionStatus | 'ALL') => void
  discountType: DiscountType | 'ALL'
  onDiscountTypeChange: (val: DiscountType | 'ALL') => void
  sortBy: 'createdAt' | 'name' | 'endDate'
  onSortByChange: (val: 'createdAt' | 'name' | 'endDate') => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (val: 'asc' | 'desc') => void
  includeDeleted: boolean
  onIncludeDeletedChange: (val: boolean) => void
  page: number
  onPageChange: (val: number | ((p: number) => number)) => void
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  restoreMutation: UseMutationResult<unknown, Error, string>
  onCreateClick: () => void
  onEditClick: (promo: Promotion) => void
  onDeleteClick: (promo: Promotion) => void
}

export function PromotionsListView({
  promotionsData,
  isLoading,
  keyword,
  onKeywordChange,
  status,
  onStatusChange,
  discountType,
  onDiscountTypeChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  includeDeleted,
  onIncludeDeletedChange,
  page,
  onPageChange,
  canCreate,
  canUpdate,
  canDelete,
  restoreMutation,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: PromotionsListViewProps) {
  const promotionsList = promotionsData?.list ?? []

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Keyword Search */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Tìm kiếm chương trình
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Nhập tên voucher / khuyến mãi..."
                  value={keyword}
                  onChange={(e) => {
                    onKeywordChange(e.target.value)
                    onPageChange(1)
                  }}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Trạng thái hiệu lực
              </label>
              <select
                aria-label="Lọc theo trạng thái khuyến mãi"
                value={status}
                onChange={(e) => {
                  onStatusChange(e.target.value as PromotionStatus | 'ALL')
                  onPageChange(1)
                }}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang áp dụng (ACTIVE)</option>
                <option value="UPCOMING">Sắp diễn ra (UPCOMING)</option>
                <option value="EXPIRED">Đã kết thúc (EXPIRED)</option>
                <option value="DELETED">Đã xóa / Đã ngưng (DELETED)</option>
              </select>
            </div>

            {/* Discount Type Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Hình thức giảm giá
              </label>
              <select
                aria-label="Lọc theo hình thức giảm giá"
                value={discountType}
                onChange={(e) => {
                  onDiscountTypeChange(e.target.value as DiscountType | 'ALL')
                  onPageChange(1)
                }}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="ALL">Tất cả hình thức</option>
                <option value="PERCENTAGE">Theo phần trăm (%)</option>
                <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Sắp xếp theo
              </label>
              <div className="flex gap-2">
                <select
                  aria-label="Sắp xếp theo trường"
                  value={sortBy}
                  onChange={(e) => {
                    onSortByChange(e.target.value as 'createdAt' | 'name' | 'endDate')
                    onPageChange(1)
                  }}
                  className="flex-1 h-9 rounded-md border border-input bg-card px-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="createdAt">Mới tạo nhất</option>
                  <option value="endDate">Ngày kết thúc</option>
                  <option value="name">Tên A-Z</option>
                </select>
                <select
                  aria-label="Thứ tự sắp xếp"
                  value={sortOrder}
                  onChange={(e) => {
                    onSortOrderChange(e.target.value as 'asc' | 'desc')
                    onPageChange(1)
                  }}
                  className="w-20 h-9 rounded-md border border-input bg-card px-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="desc">Giảm</option>
                  <option value="asc">Tăng</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => {
                  onIncludeDeletedChange(e.target.checked)
                  onPageChange(1)
                }}
                className="rounded border-input text-emerald-700 focus:ring-emerald-700"
              />
              Bao gồm các chương trình đã xóa hoặc ngưng hoạt động
            </label>

            <span className="text-xs text-muted-foreground">
              Tìm thấy {promotionsData?.totalItems ?? 0} chương trình
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Promotions List / Cards */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Đang tải danh sách khuyến mãi…
        </div>
      ) : promotionsList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-semibold text-foreground">
              Chưa có chương trình khuyến mãi nào
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Tạo các ưu đãi giảm giá theo phần trăm hoặc số tiền cố định để kích cầu doanh số.
            </p>
            {canCreate && (
              <Button
                onClick={onCreateClick}
                className="mt-4 gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <Plus className="h-4 w-4" />
                Tạo khuyến mãi mới
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotionsList.map((promo) => {
            const isPercentage = promo.discountType === 'PERCENTAGE'
            const isDeleted = promo.status === 'DELETED'

            return (
              <Card
                key={promo.id}
                className={`relative overflow-hidden border transition-all shadow-xs hover:shadow-sm ${
                  promo.status === 'ACTIVE'
                    ? 'border-emerald-200 bg-card'
                    : promo.status === 'UPCOMING'
                      ? 'border-blue-200 bg-blue-50/20'
                      : isDeleted
                        ? 'border-red-200 bg-red-50/10 opacity-75'
                        : 'border-border bg-muted/20 opacity-80'
                }`}
              >
                {/* Visual Top Bar */}
                <div
                  className={`h-1.5 w-full ${
                    promo.status === 'ACTIVE'
                      ? 'bg-emerald-600'
                      : promo.status === 'UPCOMING'
                        ? 'bg-blue-600'
                        : isDeleted
                          ? 'bg-red-500'
                          : 'bg-slate-400'
                  }`}
                />

                <div className="p-4 sm:p-5 space-y-3">
                  {/* Header: Title + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-foreground leading-snug line-clamp-1">
                        {promo.name}
                      </h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        Mã: {promo.id.slice(0, 8)}…
                      </p>
                    </div>

                    <div>
                      {promo.status === 'ACTIVE' && (
                        <Badge className="bg-emerald-700 text-white hover:bg-emerald-800">
                          Đang chạy
                        </Badge>
                      )}
                      {promo.status === 'UPCOMING' && (
                        <Badge className="bg-blue-600 text-white hover:bg-blue-700">
                          Sắp diễn ra
                        </Badge>
                      )}
                      {promo.status === 'EXPIRED' && (
                        <Badge variant="outline" className="text-slate-600 border-slate-300">
                          Hết hạn
                        </Badge>
                      )}
                      {promo.status === 'DELETED' && (
                        <Badge variant="destructive">Đã ngưng</Badge>
                      )}
                    </div>
                  </div>

                  {/* Discount Value Badge */}
                  <div className="p-3 rounded-lg bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-md bg-emerald-700 text-white">
                        {isPercentage ? (
                          <Percent className="h-4 w-4" />
                        ) : (
                          <Tag className="h-4 w-4" />
                        )}
                      </span>
                      <div>
                        <span className="text-xs font-semibold text-emerald-950 uppercase block">
                          Mức chiết khấu:
                        </span>
                        <span className="text-lg font-extrabold text-emerald-800">
                          {isPercentage
                            ? `Giảm ${promo.discountValue}%`
                            : `Giảm ${formatDiscountAmount(promo.discountValue)}`}
                        </span>
                      </div>
                    </div>

                    {isPercentage && promo.maxDiscount && (
                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground block">
                          Mức giảm tối đa:
                        </span>
                        <span className="text-xs font-bold text-emerald-900">
                          {formatDiscountAmount(promo.maxDiscount)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Timing & Usage stats */}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Từ: <strong className="text-foreground">{formatDateTime(promo.startDate)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>
                        Đến: <strong className="text-foreground">{formatDateTime(promo.endDate)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-emerald-700" />
                        Lượt sử dụng:
                      </span>
                      <span className="font-bold text-foreground">
                        {promo.usageCount} hóa đơn
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                    {!isDeleted ? (
                      <>
                        {canUpdate && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditClick(promo)}
                            className="gap-1 text-xs"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Sửa
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteClick(promo)}
                            className="gap-1 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Xóa
                          </Button>
                        )}
                      </>
                    ) : (
                      canUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(promo.id)}
                          className="gap-1 text-xs text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Khôi phục
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {promotionsData && promotionsData.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <span className="text-sm text-muted-foreground">
            Trang {promotionsData.currentPage} / {promotionsData.totalPages} (Tổng{' '}
            {promotionsData.totalItems} chương trình)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange((p: number) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= promotionsData.totalPages}
              onClick={() => onPageChange((p: number) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
