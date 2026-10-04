import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Ticket, Plus, RefreshCw, AlertCircle } from 'lucide-react'
import {
  getPromotions,
  restorePromotion,
  type Promotion,
  type PromotionStatus,
  type DiscountType,
} from './promotions.api'
import { errorMessage } from '../../shared/api/client'
import type { Session } from '../auth/session'
import { Button } from '../../shared/ui'
import { PromotionKpis } from './components/promotion-kpis'
import { PromotionsListView } from './components/promotions-list-view'
import {
  CreatePromotionModal,
  EditPromotionModal,
  DeletePromotionModal,
} from './components/promotion-modals'

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
      <PromotionKpis stats={stats} />

      {/* Promotions List View */}
      <PromotionsListView
        promotionsData={promotionsData}
        isLoading={isLoading}
        keyword={keyword}
        onKeywordChange={setKeyword}
        status={status}
        onStatusChange={setStatus}
        discountType={discountType}
        onDiscountTypeChange={setDiscountType}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        includeDeleted={includeDeleted}
        onIncludeDeletedChange={setIncludeDeleted}
        page={page}
        onPageChange={setPage}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        restoreMutation={restoreMutation}
        onCreateClick={() => setCreateModalOpen(true)}
        onEditClick={setEditTarget}
        onDeleteClick={setDeleteTarget}
      />

      {/* MODALS */}
      <CreatePromotionModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false)
          void queryClient.invalidateQueries({ queryKey: ['private', 'promotions'] })
        }}
      />

      <EditPromotionModal
        promotion={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          setEditTarget(null)
          void queryClient.invalidateQueries({ queryKey: ['private', 'promotions'] })
        }}
      />

      <DeletePromotionModal
        promotion={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => {
          setDeleteTarget(null)
          void queryClient.invalidateQueries({ queryKey: ['private', 'promotions'] })
        }}
      />
    </div>
  )
}
