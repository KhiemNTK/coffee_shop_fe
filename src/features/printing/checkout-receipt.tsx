import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, RefreshCw } from 'lucide-react'
import type { Session } from '@/features/auth/session'
import { ApiError, errorMessage } from '@/shared/api/client'
import { Button, Input } from '@/shared/ui/index'
import { printingApi, printingKeys, type ReprintReceiptDto } from '@/features/printing/printing.api'

export function CheckoutReceipt({ invoiceId }: { invoiceId: string }) {
  const { employee, access } = useOutletContext<Session>()
  const { t } = useTranslation()
  const client = useQueryClient()
  const canRead = access.has('/print-jobs_read')
  const canReprint = access.has('/receipts_reprint')
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const flight = useRef(false)
  const key = [...printingKeys.jobs(employee.id), 'receipt', invoiceId] as const
  const jobs = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      printingApi.getJobs({ invoiceId, type: 'RECEIPT', itemPerPage: 1 }, signal),
    enabled: canRead,
    staleTime: 0,
    // shortcut: stop polling after ten reads; use manual refresh during longer printer outages.
    refetchInterval: (query) => {
      const latest = query.state.data?.list[0]
      return !query.state.error &&
        query.state.dataUpdateCount < 10 &&
        (!latest || latest.status === 'PENDING' || latest.status === 'PROCESSING')
        ? 3000
        : false
    }
  })
  const reprint = useMutation({
    mutationFn: (dto: ReprintReceiptDto) => printingApi.reprintReceipt(invoiceId, dto),
    onSuccess: async () => {
      setUncertain(false)
      setOpen(false)
      setReason('')
      await client.invalidateQueries({ queryKey: printingKeys.jobs(employee.id) })
    },
    onError: (error) => {
      setUncertain(
        (wasUncertain) =>
          wasUncertain ||
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 408 &&
            error.status !== 429
          )
      )
    },
    onSettled: () => {
      flight.current = false
    }
  })
  const job = canRead ? jobs.data?.list[0] : reprint.data
  const inProgress = job?.status === 'PENDING' || job?.status === 'PROCESSING' || job?.status === 'REQUIRES_REVIEW'

  if (!canRead && !canReprint) return null

  return (
    <section
      aria-label={t('receipt.title')}
      className="mb-4 space-y-3 border-t border-border pt-4 text-left text-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Printer className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p role="status" className="min-w-0 break-words">
            {job
              ? t(`receipt.status.${job.status}`)
              : canRead
                ? t(
                    jobs.isPending
                      ? 'receipt.checking'
                      : jobs.isError
                        ? 'receipt.unavailable'
                        : 'receipt.waiting'
                  )
                : t('receipt.noReadPermission')}
          </p>
        </div>
        {canRead && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t('receipt.refresh')}
            aria-label={t('receipt.refresh')}
            disabled={jobs.isFetching}
            onClick={() => void jobs.refetch()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {canReprint && !open && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            reprint.reset()
            setOpen(true)
          }}
          disabled={inProgress || (canRead && (jobs.isPending || jobs.isFetching))}
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t('receipt.reprint')}
        </Button>
      )}
      {canReprint && open && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (flight.current) return
            const dto = uncertain ? reprint.variables : { reason: reason.trim() }
            if (!dto || dto.reason.length < 3 || dto.reason.length > 500) return
            flight.current = true
            reprint.mutate(dto)
          }}
        >
          <label className="block space-y-1">
            <span>{t('receipt.reason')}</span>
            <Input
              value={reason}
              minLength={3}
              maxLength={500}
              required
              disabled={reprint.isPending || uncertain}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {reprint.isError && (
            <p role="alert" className="text-destructive">
              {errorMessage(reprint.error)}
            </p>
          )}
          {uncertain && <p className="text-muted-foreground">{t('receipt.uncertain')}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={reprint.isPending || uncertain}
              onClick={() => setOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={reprint.isPending}
              disabled={!uncertain && reason.trim().length < 3}
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              {t(uncertain ? 'common.retry' : 'receipt.confirmReprint')}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
