import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Check, RefreshCw } from 'lucide-react'
import type { Session } from '../../auth/session'
import { getHandoffQueue, handoffItem } from '../pos.api'
import { kitchenKeys } from '../../kitchen/kitchen.api'
import { errorMessage } from '../../../shared/api/client'
import { formatStoreDateTime } from '../../../shared/lib/store-time'
import {
  Badge,
  Button,
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'

export function TakeawayHandoffQueue() {
  const { t: translate } = useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const [page, setPage] = useState(1)
  const flight = useRef(false)
  const [reviewRequired, setReviewRequired] = useState(false)
  const canHandoff = access.has('/orders_items_handoff')
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['private', employee.id, 'takeaway-handoff', page],
    queryFn: ({ signal }) => getHandoffQueue(page, signal),
    refetchInterval: 10_000,
    enabled: access.has('/orders_sessions_read'),
  })
  const mutation = useMutation({
    retry: false,
    mutationFn: handoffItem,
    onSuccess: () => {
      setTarget(null)
    },
    onError: () => setReviewRequired(true),
    onSettled: () => {
      flight.current = false
      void client.invalidateQueries({
        queryKey: ['private', employee.id, 'takeaway-handoff'],
      })
      void client.invalidateQueries({ queryKey: kitchenKeys.all(employee.id) })
      void client.invalidateQueries({ queryKey: ['private', employee.id, 'orders'] })
    },
  })
  async function review() {
    if (flight.current) return
    const result = await query.refetch()
    if (result.isSuccess) {
      setReviewRequired(false)
      setTarget(null)
      mutation.reset()
    }
  }
  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{translate('pos.handoffHeading')}</h2>
        <Button
          variant="outline"
          size="sm"
          aria-label={translate('pos.refreshHandoff')}
          onClick={() => void review()}
          disabled={query.isFetching || mutation.isPending}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {query.isPending && <p role="status">{translate('pos.loadingHandoff')}</p>}
      {query.isError && (
        <p role="alert" className="text-destructive">
          {errorMessage(query.error)}
        </p>
      )}
      {reviewRequired && (
        <Button
          variant="outline"
          disabled={query.isFetching || mutation.isPending}
          onClick={() => void review()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {translate('pos.reviewHandoff')}
        </Button>
      )}
      {query.isSuccess && query.data.list.length === 0 && (
        <p className="text-sm text-muted-foreground">{translate('pos.noHandoff')}</p>
      )}
      <ul className="divide-y">
        {query.isSuccess &&
          query.data.list.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 min-w-0"
            >
              <div className="min-w-0 flex-1">
                <p
                  className="break-words line-clamp-2 text-sm font-medium leading-snug"
                  title={`${item.quantity} × ${item.menuItem.name}`}
                >
                  {item.quantity} × {item.menuItem.name}
                </p>
                {item.replacementRemake && (
                  <div className="mt-1 space-y-1">
                    <Badge variant="secondary">{translate('pos.remake')}</Badge>
                    <p className="break-words text-xs text-muted-foreground">
                      {item.replacementRemake.reason}
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {item.ticketNumber ?? item.orderSessionId.slice(0, 8)} ·{' '}
                  {item.readyAt ? formatStoreDateTime(item.readyAt) : translate('common.ready')}
                </p>
              </div>
              {canHandoff && (
                <Button
                  size="sm"
                  className="shrink-0"
                  disabled={mutation.isPending || reviewRequired || query.isFetching}
                  onClick={() => {
                    if (flight.current) return
                    mutation.reset()
                    setTarget({ id: item.id, name: item.menuItem.name })
                  }}
                >
                  <Check size={16} />
                  {translate('pos.handoff')}
                </Button>
              )}
            </li>
          ))}
      </ul>
      <Pagination
        page={page}
        totalPages={query.data?.totalPages ?? 0}
        onPage={setPage}
        disabled={query.isFetching || mutation.isPending}
      />
      {query.isSuccess && page > Math.max(1, query.data.totalPages) && (
        <Button variant="outline" onClick={() => setPage(1)}>
          {translate('common.firstPage')}
        </Button>
      )}
      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open && !flight.current) setTarget(null)
        }}
      >
        <DialogTitle>{translate('pos.confirmHandoff')}</DialogTitle>
        <DialogDescription>{target?.name}</DialogDescription>
        {mutation.isError && (
          <div className="space-y-2">
            <p role="alert" className="text-destructive">
              {errorMessage(mutation.error)}
            </p>
            <Button variant="outline" disabled={query.isFetching} onClick={() => void review()}>
              <RefreshCw size={16} aria-hidden="true" />
              {translate('pos.reviewHandoff')}
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setTarget(null)}>
            {translate('common.back')}
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={!canHandoff || reviewRequired || query.isFetching || !query.isSuccess}
            onClick={() => {
              if (
                target &&
                canHandoff &&
                !flight.current &&
                !reviewRequired &&
                !query.isFetching &&
                query.isSuccess
              ) {
                flight.current = true
                mutation.mutate(target.id)
              }
            }}
          >
            <Check size={16} />
            {translate('pos.handedOver')}
          </Button>
        </DialogFooter>
      </Dialog>
    </section>
  )
}
