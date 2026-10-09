import { Edit2, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import type {
  DiscountType,
  Promotion,
  PromotionStatus,
  PaginatedPromotions,
} from '../promotions.api'
import { formatPrice } from '../../../shared/lib/format'
import { formatStoreDateTime } from '../../../shared/lib/store-time'
import { Badge, Button, Card, Input } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'

interface Props {
  promotionsData?: PaginatedPromotions
  isLoading: boolean
  hasError: boolean
  keyword: string
  onKeywordChange: (value: string) => void
  status: PromotionStatus | 'ALL'
  onStatusChange: (value: PromotionStatus | 'ALL') => void
  discountType: DiscountType | 'ALL'
  onDiscountTypeChange: (value: DiscountType | 'ALL') => void
  sortBy: 'createdAt' | 'name' | 'endDate'
  onSortByChange: (value: 'createdAt' | 'name' | 'endDate') => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (value: 'asc' | 'desc') => void
  includeDeleted: boolean
  onIncludeDeletedChange: (value: boolean) => void
  page: number
  onPageChange: (value: number) => void
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  onCreateClick: () => void
  onEditClick: (promotion: Promotion) => void
  onDeleteClick: (promotion: Promotion) => void
  onRestoreClick: (promotion: Promotion) => void
}
const statusLabel = {
  ACTIVE: 'Đang áp dụng',
  UPCOMING: 'Sắp diễn ra',
  EXPIRED: 'Hết hạn',
  DELETED: 'Đã ngưng',
}
const statusFilterLabel: Record<PromotionStatus, string> = {
  ACTIVE: 'Chỉ đang áp dụng',
  UPCOMING: 'Chỉ sắp diễn ra',
  EXPIRED: 'Chỉ đã hết hạn',
  DELETED: 'Chỉ đã ngưng',
}
const selectClass = 'h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm'

export function PromotionsListView(props: Props) {
  const { promotionsData: data, onPageChange } = props
  return (
    <div className="space-y-4">
      <section className="space-y-3 border-y border-border py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="promotion-search" className="text-sm font-medium">
              Tìm kiếm chương trình
            </label>
            <div className="relative">
              <Search
                size={16}
                aria-hidden="true"
                className="absolute left-3 top-3 text-muted-foreground"
              />
              <Input
                id="promotion-search"
                maxLength={100}
                className="pl-9"
                placeholder="Nhập tên khuyến mãi..."
                value={props.keyword}
                onChange={(event) => props.onKeywordChange(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="promotion-status" className="text-sm font-medium">
              Trạng thái hiệu lực
            </label>
            <select
              id="promotion-status"
              aria-label="Lọc theo trạng thái khuyến mãi"
              className={selectClass}
              value={props.status}
              onChange={(event) => {
                props.onStatusChange(event.target.value as Props['status'])
                onPageChange(1)
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(statusFilterLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="promotion-type" className="text-sm font-medium">
              Hình thức giảm giá
            </label>
            <select
              id="promotion-type"
              aria-label="Lọc theo hình thức giảm giá"
              className={selectClass}
              value={props.discountType}
              onChange={(event) => {
                props.onDiscountTypeChange(event.target.value as Props['discountType'])
                onPageChange(1)
              }}
            >
              <option value="ALL">Tất cả hình thức</option>
              <option value="PERCENTAGE">Theo phần trăm (%)</option>
              <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="promotion-sort" className="text-sm font-medium">
              Sắp xếp theo
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
              <select
                id="promotion-sort"
                className={selectClass}
                value={props.sortBy}
                onChange={(event) => {
                  props.onSortByChange(event.target.value as Props['sortBy'])
                  onPageChange(1)
                }}
              >
                <option value="createdAt">Ngày tạo</option>
                <option value="endDate">Ngày kết thúc</option>
                <option value="name">Tên</option>
              </select>
              <select
                aria-label="Thứ tự sắp xếp"
                className={selectClass}
                value={props.sortOrder}
                onChange={(event) => {
                  props.onSortOrderChange(event.target.value as Props['sortOrder'])
                  onPageChange(1)
                }}
              >
                <option value="desc">Giảm</option>
                <option value="asc">Tăng</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={props.includeDeleted}
              onChange={(event) => {
                props.onIncludeDeletedChange(event.target.checked)
                onPageChange(1)
              }}
            />
            Bao gồm chương trình đã ngưng
          </label>
          {!props.hasError && !props.isLoading && data && (
            <span className="text-muted-foreground">Tìm thấy {data.totalItems} chương trình</span>
          )}
        </div>
      </section>
      {props.hasError ? null : props.isLoading ? (
        <p role="status" className="py-8 text-center text-sm">
          Đang tải danh sách khuyến mãi…
        </p>
      ) : !data?.list.length ? (
        <div className="py-8 text-center space-y-3">
          <p>Không có khuyến mãi phù hợp bộ lọc.</p>
          {props.canCreate && (
            <Button onClick={props.onCreateClick}>
              <Plus size={16} aria-hidden="true" />
              Tạo khuyến mãi mới
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.list.map((promotion) => (
              <Card key={promotion.id} className="min-w-0 space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="min-w-0 flex-1 break-words text-base font-semibold">
                    {promotion.name}
                  </h2>
                  <Badge
                    variant={
                      promotion.status === 'DELETED'
                        ? 'destructive'
                        : promotion.status === 'ACTIVE'
                          ? 'default'
                          : 'outline'
                    }
                  >
                    {statusLabel[promotion.status]}
                  </Badge>
                </div>
                <p className="break-words text-lg font-semibold">
                  {promotion.discountType === 'PERCENTAGE'
                    ? `Giảm ${promotion.discountValue}%`
                    : `Giảm ${formatPrice(promotion.discountValue)}`}
                </p>
                {promotion.discountType === 'PERCENTAGE' && promotion.maxDiscount != null && (
                  <p className="text-sm">Tối đa: {formatPrice(promotion.maxDiscount)}</p>
                )}
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Bắt đầu (Việt Nam)</dt>
                    <dd>{formatStoreDateTime(promotion.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Kết thúc (Việt Nam)</dt>
                    <dd>{formatStoreDateTime(promotion.endDate)}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted-foreground">Đã được gắn vào</dt>
                    <dd>{promotion.usageCount} hóa đơn</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                  {promotion.status === 'DELETED' ? (
                    props.canUpdate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => props.onRestoreClick(promotion)}
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        Khôi phục
                      </Button>
                    )
                  ) : (
                    <>
                      {props.canUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Sửa ${promotion.name}`}
                          title={`Sửa ${promotion.name}`}
                          onClick={() => props.onEditClick(promotion)}
                        >
                          <Edit2 size={16} aria-hidden="true" />
                        </Button>
                      )}
                      {props.canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => props.onDeleteClick(promotion)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          Ngừng áp dụng
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      {!props.hasError && !props.isLoading && data && (
        <>
          {(data.totalPages > 1 || props.page > 1) && (
            <Pagination page={props.page} totalPages={data.totalPages} onPage={onPageChange} />
          )}
          {props.page > Math.max(1, data.totalPages) && (
            <Button variant="outline" onClick={() => onPageChange(1)}>
              Về trang đầu
            </Button>
          )}
        </>
      )}
    </div>
  )
}
