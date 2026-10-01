import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  Tag,
  Ticket,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  RotateCcw,
  AlertCircle,
  TrendingUp,
  Receipt,
  Sparkles,
} from 'lucide-react'
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  restorePromotion,
  type Promotion,
  type PromotionStatus,
  type DiscountType,
} from './promotions.api'
import { formatPrice } from '../menu/menu.api'
import { errorMessage } from '../../shared/api/client'
import type { Session } from '../auth/session'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../shared/ui'

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string) {
  return `${formatTime(iso)} ${formatDate(iso)}`
}

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}

function formatDiscountAmount(val: string | number) {
  return formatPrice(String(val))
}

export default function PromotionsPage() {
  const queryClient = useQueryClient()
  const session = useOutletContext<Session | undefined>()
  const permissions = session?.authorization.permissionKeys ?? []

  const canCreate = permissions.includes('/promotions_create')
  const canUpdate = permissions.includes('/promotions_update')
  const canDelete = permissions.includes('/promotions_delete')

  // Search & Filter state
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<PromotionStatus | 'ALL'>('ALL')
  const [discountType, setDiscountType] = useState<DiscountType | 'ALL'>('ALL')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'endDate'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Promotion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Query promotions
  const {
    data: promotionsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      'private',
      'promotions',
      page,
      keyword,
      status,
      discountType,
      includeDeleted,
      sortBy,
      sortOrder,
    ],
    queryFn: ({ signal }) =>
      getPromotions(
        {
          page,
          itemPerPage: 12,
          keyword: keyword.trim() || undefined,
          status: status === 'ALL' ? undefined : status,
          discountType: discountType === 'ALL' ? undefined : discountType,
          includeDeleted,
          sortBy,
          sortOrder,
        },
        signal,
      ),
    staleTime: 15_000,
  })

  // Mutation: Restore
  const restoreMutation = useMutation({
    mutationFn: (id: string) => restorePromotion(id),
    onSuccess: () => {
      setActionError(null)
      void queryClient.invalidateQueries({ queryKey: ['private', 'promotions'] })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const promotionsList = promotionsData?.list ?? []

  // KPI stats from active results
  const stats = useMemo(() => {
    let active = 0
    let upcoming = 0
    let expired = 0
    let totalUsage = 0

    for (const p of promotionsData?.list ?? []) {
      if (p.status === 'ACTIVE') active++
      else if (p.status === 'UPCOMING') upcoming++
      else if (p.status === 'EXPIRED') expired++
      totalUsage += p.usageCount || 0
    }

    return { active, upcoming, expired, totalUsage }
  }, [promotionsData?.list])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Ticket className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Chương trình Khuyến mãi & Voucher
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Thiết lập các chính sách chiết khấu, voucher giảm giá và theo dõi hiệu quả trên hóa đơn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <Plus className="h-4 w-4" />
              Tạo khuyến mãi mới
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-600 hover:underline font-medium text-xs"
          >
            Bỏ qua
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Đang áp dụng
              </span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {stats.active}
              </p>
            </div>
            <span className="p-2.5 rounded-full bg-emerald-50 text-emerald-700">
              <Sparkles className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Sắp diễn ra
              </span>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {stats.upcoming}
              </p>
            </div>
            <span className="p-2.5 rounded-full bg-blue-50 text-blue-700">
              <Clock className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Đã hết hạn
              </span>
              <p className="text-2xl font-bold text-slate-600 mt-1">
                {stats.expired}
              </p>
            </div>
            <span className="p-2.5 rounded-full bg-slate-100 text-slate-600">
              <Calendar className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Lượt dùng trên hóa đơn
              </span>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stats.totalUsage}
              </p>
            </div>
            <span className="p-2.5 rounded-full bg-amber-50 text-amber-700">
              <Receipt className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>
      </div>

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
                    setKeyword(e.target.value)
                    setPage(1)
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
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as PromotionStatus | 'ALL')
                  setPage(1)
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
                value={discountType}
                onChange={(e) => {
                  setDiscountType(e.target.value as DiscountType | 'ALL')
                  setPage(1)
                }}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="ALL">Tất cả hình thức</option>
                <option value="PERCENTAGE">Theo phần trăm (%)</option>
                <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
              </select>
            </div>

            {/* Sắp xếp & Checkbox includeDeleted */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Sắp xếp theo
              </label>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as 'createdAt' | 'name' | 'endDate')
                    setPage(1)
                  }}
                  className="flex-1 h-9 rounded-md border border-input bg-card px-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="createdAt">Mới tạo nhất</option>
                  <option value="endDate">Ngày kết thúc</option>
                  <option value="name">Tên A-Z</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value as 'asc' | 'desc')
                    setPage(1)
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
                  setIncludeDeleted(e.target.checked)
                  setPage(1)
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
                onClick={() => setCreateModalOpen(true)}
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
                            onClick={() => setEditTarget(promo)}
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
                            onClick={() => setDeleteTarget(promo)}
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= promotionsData.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PROMOTION */}
      {createModalOpen && (
        <CreatePromotionModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false)
            void queryClient.invalidateQueries({ queryKey: ['private', 'promotions'] })
          }}
        />
      )}

      {/* MODAL: EDIT PROMOTION */}
      {editTarget && (
        <EditPromotionModal
          promotion={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null)
            void queryClient.invalidateQueries({ queryKey: ['private', 'promotions'] })
          }}
        />
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteTarget && (
        <DeletePromotionModal
          promotion={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            setDeleteTarget(null)
            void queryClient.invalidateQueries({ queryKey: ['private', 'promotions'] })
          }}
        />
      )}
    </div>
  )
}

// ================= MODAL COMPONENTS =================

interface CreateModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function CreatePromotionModal({ open, onClose, onSuccess }: CreateModalProps) {
  const [name, setName] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState<number>(10)
  const [maxDiscount, setMaxDiscount] = useState<string>('')

  // Default: Starts today, ends in 30 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return toDatetimeLocal(d)
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    return toDatetimeLocal(d)
  })

  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () => {
      const s = new Date(startDate)
      const e = new Date(endDate)
      return createPromotion({
        name: name.trim(),
        discountType,
        discountValue,
        maxDiscount:
          discountType === 'PERCENTAGE' && maxDiscount.trim()
            ? Number(maxDiscount)
            : null,
        startDate: s.toISOString(),
        endDate: e.toISOString(),
      })
    },
    onSuccess: () => onSuccess(),
    onError: (err) => setError(errorMessage(err)),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Vui lòng nhập tên chương trình khuyến mãi.')
      return
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setError('Ngày kết thúc phải diễn ra sau ngày bắt đầu.')
      return
    }
    if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
      setError('Tỷ lệ giảm giá theo phần trăm phải nằm trong khoảng từ 1% đến 100%.')
      return
    }
    if (discountType === 'FIXED_AMOUNT' && discountValue <= 0) {
      setError('Số tiền giảm giá phải lớn hơn 0.')
      return
    }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Tạo chương trình khuyến mãi mới</DialogTitle>
          <DialogDescription>
            Cấu hình mã ưu đãi, hình thức chiết khấu và thời gian áp dụng trên hóa đơn.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2 text-sm">
          <div>
            <label className="font-semibold text-foreground block mb-1">
              Tên chương trình khuyến mãi <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              placeholder="Ví dụ: Khai xuân rộn ràng - Giảm 20%"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Hình thức giảm giá <span className="text-red-500">*</span>
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="PERCENTAGE">Theo phần trăm (%)</option>
                <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">
                {discountType === 'PERCENTAGE'
                  ? 'Tỷ lệ giảm (%) *'
                  : 'Số tiền giảm (₫) *'}
              </label>
              <Input
                type="number"
                min={1}
                max={discountType === 'PERCENTAGE' ? 100 : undefined}
                required
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
              />
            </div>
          </div>

          {discountType === 'PERCENTAGE' && (
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Số tiền giảm tối đa (₫) (Tùy chọn)
              </label>
              <Input
                type="number"
                min={0}
                placeholder="Ví dụ: 50000 (để trống nếu không giới hạn)"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
              />
              <span className="text-xs text-muted-foreground mt-0.5 block">
                Nếu hóa đơn giảm 20% vượt quá số tiền này thì chỉ giảm tối đa mức trên.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Ngày bắt đầu <span className="text-red-500">*</span>
              </label>
              <Input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">
                Ngày kết thúc <span className="text-red-500">*</span>
              </label>
              <Input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-2">
              Xem trước hiển thị Voucher:
            </span>
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-bold text-foreground">
                  {name.trim() || 'Tên chương trình ưu đãi'}
                </h5>
                <p className="text-xs text-emerald-800 font-medium">
                  {discountType === 'PERCENTAGE'
                    ? `Giảm ${discountValue || 0}%${maxDiscount ? ` (Tối đa ${formatDiscountAmount(maxDiscount)})` : ''}`
                    : `Giảm ${formatDiscountAmount(discountValue || 0)}`}
                </p>
              </div>
              <Badge className="bg-emerald-700 text-white">Ưu đãi</Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {createMutation.isPending ? 'Đang tạo…' : 'Xác nhận tạo khuyến mãi'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

interface EditModalProps {
  promotion: Promotion
  onClose: () => void
  onSuccess: () => void
}

function EditPromotionModal({ promotion, onClose, onSuccess }: EditModalProps) {
  const [name, setName] = useState(promotion.name)
  const [discountType, setDiscountType] = useState<DiscountType>(promotion.discountType)
  const [discountValue, setDiscountValue] = useState<number>(Number(promotion.discountValue))
  const [maxDiscount, setMaxDiscount] = useState<string>(
    promotion.maxDiscount ? String(promotion.maxDiscount) : '',
  )
  const [startDate, setStartDate] = useState(() =>
    toDatetimeLocal(new Date(promotion.startDate)),
  )
  const [endDate, setEndDate] = useState(() =>
    toDatetimeLocal(new Date(promotion.endDate)),
  )
  const [error, setError] = useState<string | null>(null)

  const isFinancialLocked = (promotion.usageCount || 0) > 0

  const updateMutation = useMutation({
    mutationFn: () => {
      const s = new Date(startDate)
      const e = new Date(endDate)
      return updatePromotion(promotion.id, {
        name: name.trim(),
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        ...(isFinancialLocked
          ? {}
          : {
              discountType,
              discountValue,
              maxDiscount:
                discountType === 'PERCENTAGE' && maxDiscount.trim()
                  ? Number(maxDiscount)
                  : null,
            }),
      })
    },
    onSuccess: () => onSuccess(),
    onError: (err) => setError(errorMessage(err)),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (new Date(endDate) <= new Date(startDate)) {
      setError('Ngày kết thúc phải diễn ra sau ngày bắt đầu.')
      return
    }
    updateMutation.mutate()
  }

  return (
    <Dialog open={true} onClose={onClose} maxWidth="md">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Cập nhật chương trình khuyến mãi</DialogTitle>
          <DialogDescription>
            Mã chương trình: {promotion.id.slice(0, 8)}…
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {error}
          </div>
        )}

        {isFinancialLocked && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Lưu ý bảo toàn số liệu tài chính:</strong> Chương trình này đã được áp dụng trên{' '}
              {promotion.usageCount} hóa đơn. Để đảm bảo tính toàn vẹn của sổ sách kế toán, các trường loại chiết khấu và giá trị giảm được khóa. Bạn chỉ có thể gia hạn thời gian hoặc sửa tên chương trình.
            </div>
          </div>
        )}

        <div className="space-y-4 py-2 text-sm">
          <div>
            <label className="font-semibold text-foreground block mb-1">
              Tên chương trình khuyến mãi
            </label>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Hình thức giảm giá
              </label>
              <select
                disabled={isFinancialLocked}
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className={`w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700 ${
                  isFinancialLocked ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <option value="PERCENTAGE">Theo phần trăm (%)</option>
                <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">
                {discountType === 'PERCENTAGE' ? 'Tỷ lệ giảm (%)' : 'Số tiền giảm (₫)'}
              </label>
              <Input
                type="number"
                disabled={isFinancialLocked}
                min={1}
                max={discountType === 'PERCENTAGE' ? 100 : undefined}
                required
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className={isFinancialLocked ? 'opacity-60 cursor-not-allowed' : ''}
              />
            </div>
          </div>

          {discountType === 'PERCENTAGE' && (
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Số tiền giảm tối đa (₫)
              </label>
              <Input
                type="number"
                disabled={isFinancialLocked}
                min={0}
                placeholder="Để trống nếu không giới hạn"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                className={isFinancialLocked ? 'opacity-60 cursor-not-allowed' : ''}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Ngày bắt đầu
              </label>
              <Input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">
                Ngày kết thúc
              </label>
              <Input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {updateMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

interface DeleteModalProps {
  promotion: Promotion
  onClose: () => void
  onSuccess: () => void
}

function DeletePromotionModal({ promotion, onClose, onSuccess }: DeleteModalProps) {
  const [error, setError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => deletePromotion(promotion.id),
    onSuccess: () => onSuccess(),
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Ngừng áp dụng khuyến mãi
        </DialogTitle>
        <DialogDescription>
          Bạn có chắc chắn muốn ngừng áp dụng chương trình{' '}
          <strong>{promotion.name}</strong> không?
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="py-2 text-xs text-muted-foreground space-y-1">
        <p>• Chương trình sẽ được đánh dấu ngừng hoạt động và không thể áp dụng cho các đơn hàng mới.</p>
        <p>• Các hóa đơn cũ đã áp dụng voucher này trong quá khứ sẽ vẫn được bảo lưu nguyên vẹn.</p>
        <p>• Bạn có thể khôi phục lại chương trình này bất kỳ lúc nào.</p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Đóng
        </Button>
        <Button
          variant="destructive"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          {deleteMutation.isPending ? 'Đang xóa…' : 'Xác nhận ngừng áp dụng'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
