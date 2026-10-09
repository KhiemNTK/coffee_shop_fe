import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Ticket, Plus, RefreshCw } from 'lucide-react'
import {
  getPromotions,
  promotionKeys,
  type Promotion,
  type PromotionStatus,
  type DiscountType,
} from './promotions.api'
import { errorMessage } from '../../shared/api/client'
import type { Session } from '../auth/session'
import { Button } from '../../shared/ui'
import { PromotionsListView } from './components/promotions-list-view'
import { PromotionEditorModal, PromotionCommandModal } from './components/promotion-modals'

export default function PromotionsPage() {
  const client = useQueryClient()
  const session = useOutletContext<Session>()
  const employeeId = session.employee.id
  const permissions = session.authorization.permissionKeys
  const canCreate = permissions.includes('/promotions_create')
  const canUpdate = permissions.includes('/promotions_update')
  const canDelete = permissions.includes('/promotions_delete')
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PromotionStatus | 'ALL'>('ALL')
  const [discountType, setDiscountType] = useState<DiscountType | 'ALL'>('ALL')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'endDate'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Promotion | null>(null)
  const [command, setCommand] = useState<{
    kind: 'delete' | 'restore'
    promotion: Promotion
  } | null>(null)

  useEffect(() => {
    if (keyword.trim() === search) return
    const timer = window.setTimeout(() => {
      setSearch(keyword.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [keyword, search])
  const query = useQuery({
    queryKey: [
      ...promotionKeys.list(employeeId),
      page,
      search,
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
          keyword: search || undefined,
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
  function invalidate() {
    void client.invalidateQueries({ queryKey: promotionKeys.list(employeeId) })
    void client.invalidateQueries({ queryKey: promotionKeys.active(employeeId) })
    void client.invalidateQueries({ queryKey: ['private', employeeId, 'pos-quote'] })
  }
  const modalProps = { employeeId, onSettled: invalidate }
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Ticket size={24} aria-hidden="true" />
          Khuyến mãi hóa đơn
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Làm mới
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden="true" />
              Tạo khuyến mãi mới
            </Button>
          )}
        </div>
      </header>
      {query.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 border border-destructive rounded-md p-3 text-sm"
        >
          <p>{errorMessage(query.error)}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            Tải lại danh sách
          </Button>
        </div>
      )}
      <PromotionsListView
        promotionsData={query.data}
        isLoading={query.isPending}
        hasError={query.isError}
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
        onCreateClick={() => setCreateOpen(true)}
        onEditClick={setEditTarget}
        onDeleteClick={(promotion) => setCommand({ kind: 'delete', promotion })}
        onRestoreClick={(promotion) => setCommand({ kind: 'restore', promotion })}
      />
      {canCreate && createOpen && (
        <PromotionEditorModal
          {...modalProps}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => setCreateOpen(false)}
        />
      )}
      {canUpdate && editTarget && (
        <PromotionEditorModal
          key={editTarget.id}
          {...modalProps}
          promotionId={editTarget.id}
          onClose={() => setEditTarget(null)}
          onSuccess={() => setEditTarget(null)}
        />
      )}
      {command && (command.kind === 'delete' ? canDelete : canUpdate) && (
        <PromotionCommandModal
          key={command.kind + command.promotion.id}
          {...modalProps}
          kind={command.kind}
          promotionId={command.promotion.id}
          onClose={() => setCommand(null)}
          onSuccess={() => setCommand(null)}
        />
      )}
    </div>
  )
}
