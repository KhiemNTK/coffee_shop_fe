import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react'
import { ApiError, sessionEvents } from '../../../shared/api/client'
import { pendingIntentKey, readPendingIntent, writePendingIntent } from '../../../shared/api/pending-intent'
import { i18n, type TranslationKey } from '../../../shared/i18n'
import { insightTime as time } from '../business-insight-format'
import { BusinessInsightHistory } from './business-insight-history'
import { BusinessInsightResult } from './business-insight-result'
import { Button, Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, TabsContent } from '../../../shared/ui'
import {
  businessInsightKeys, businessInsightRecoverySchema, generateBusinessInsight, getBusinessInsight, getBusinessInsightsConfig, insightRangeError,
  type BusinessInsight, type BusinessInsightRequest,
} from '../business-insights.api'

const busy = (job?: BusinessInsight) => job?.status === 'QUEUED' || job?.status === 'PROCESSING'

function insightError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'CLIENT_RESPONSE_INVALID') return i18n.t('insights.errorInvalid')
    if (error.code === 'AI_DAILY_LIMIT') return i18n.t('insights.errorDailyLimit')
    if (error.status === 403) return i18n.t('insights.errorForbidden')
    if (error.status === 429) return i18n.t('insights.errorRateLimited')
    if (error.status === 503) return i18n.t('insights.errorUnavailable')
    if (error.status === 401) return i18n.t('insights.errorExpiredSession')
    if (error.status === 404) return i18n.t('insights.errorNotFound')
  }
  return i18n.t('insights.errorUnknown')
}

export function BusinessInsightsTab({ employeeId, from, to, active, canRead, canGenerate }: {
  employeeId: string; from: string; to: string; active: boolean; canRead: boolean; canGenerate: boolean
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const storageKey = pendingIntentKey(employeeId, 'business-insight')
  // Keep recovery separate from the report being viewed; browsing must not lose a pending request.
  const [recovery] = useState(() => {
    try {
      const intent = readPendingIntent(storageKey, businessInsightRecoverySchema)
      if (intent && (intent.createdAt > Date.now() || Date.now() - intent.createdAt >= 7 * 86_400_000 ||
          intent.idempotencyKey !== intent.payload.request.clientRequestId))
        throw new Error('Invalid or expired insight reference')
      return { intent, error: null }
    } catch {
      return { intent: null, error: 'insights.recoveryInvalid' as const }
    }
  })
  const [visible, setVisible] = useState(() => !document.hidden)
  const [request, setRequest] = useState<BusinessInsightRequest | null>(recovery.intent?.payload.request ?? null)
  const [jobId, setJobId] = useState<string | null>(recovery.intent?.payload.jobId ?? null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<TranslationKey | null>(recovery.error)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const requestedAt = useRef(recovery.intent?.createdAt ?? null)
  const controller = useRef<AbortController | null>(null)
  const submitting = useRef(false)
  const tracking = active && visible && canRead
  const viewingPreview = previewId !== null && previewId !== jobId
  const rangeError = insightRangeError(!jobId && request ? request.from : from, !jobId && request ? request.to : to)

  useEffect(() => {
    const abort = new AbortController()
    controller.current = abort
    const visibility = () => setVisible(!document.hidden)
    const expire = () => abort.abort()
    document.addEventListener('visibilitychange', visibility)
    sessionEvents.addEventListener('expired', expire)
    return () => {
      abort.abort()
      document.removeEventListener('visibilitychange', visibility)
      sessionEvents.removeEventListener('expired', expire)
    }
  }, [])

  const config = useQuery({
    queryKey: businessInsightKeys.config(employeeId),
    queryFn: ({ signal }) => getBusinessInsightsConfig(signal),
    enabled: tracking, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  const requestQuery = useQuery({
    queryKey: businessInsightKeys.job(employeeId, jobId),
    queryFn: ({ signal }) => getBusinessInsight(jobId!, request, signal),
    enabled: tracking && !!jobId,
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    staleTime: query => busy(query.state.data) ? 0 : Infinity,
    refetchInterval: query => !query.state.error && busy(query.state.data) ? 2_000 : false,
    refetchIntervalInBackground: false,
  })
  const previewQuery = useQuery({
    queryKey: businessInsightKeys.job(employeeId, previewId),
    queryFn: ({ signal }) => getBusinessInsight(previewId!, null, signal),
    enabled: tracking && viewingPreview,
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    staleTime: query => busy(query.state.data) ? 0 : Infinity,
    refetchInterval: query => !query.state.error && busy(query.state.data) ? 2_000 : false,
    refetchIntervalInBackground: false,
  })
  useEffect(() => {
    if (!tracking) void client.cancelQueries({ queryKey: businessInsightKeys.all(employeeId) })
  }, [client, employeeId, tracking])

  const mutation = useMutation({
    mutationKey: ['private', employeeId, 'business-insight-generate'],
    mutationFn: (body: BusinessInsightRequest) => generateBusinessInsight(body, controller.current!.signal),
    retry: false,
    networkMode: 'always',
    onSuccess: (job, body) => {
      if (controller.current?.signal.aborted) return
      try {
        writePendingIntent(storageKey, { payload: { request: body, jobId: job.id }, createdAt: requestedAt.current!, idempotencyKey: body.clientRequestId })
      } catch { setStorageError('insights.recoverySaveFailed') }
      client.setQueryData(businessInsightKeys.job(employeeId, job.id), job)
      void client.invalidateQueries({ queryKey: businessInsightKeys.history(employeeId) })
      setPreviewId(current => current === job.id ? null : current)
      setJobId(job.id)
    },
    onSettled: () => { submitting.current = false },
  })
  const activeJob = requestQuery.data
  const displayedQuery = viewingPreview ? previewQuery : requestQuery
  const job = displayedQuery.data
  useEffect(() => {
    if (activeJob?.status === 'COMPLETED' || activeJob?.status === 'FAILED')
      void client.invalidateQueries({ queryKey: businessInsightKeys.history(employeeId) })
  }, [client, employeeId, activeJob?.id, activeJob?.status])
  const recovering = !!jobId && requestQuery.isPending
  const blocked = !tracking || !canGenerate || config.data?.enabled !== true || config.isError ||
    config.isFetching || !!rangeError || mutation.isPending || busy(activeJob) || busy(job) ||
    requestQuery.isError || recovering || !!storageError

  function generate() {
    if (blocked || submitting.current || !controller.current || controller.current.signal.aborted) return
    const body = !jobId && request ? request : {
      clientRequestId: crypto.randomUUID(), from, to, timeZone: 'Asia/Ho_Chi_Minh' as const,
    }
    const started = body.clientRequestId === request?.clientRequestId ? requestedAt.current! : Date.now()
    if (started > Date.now() || Date.now() - started >= 7 * 86_400_000) {
      setStorageError('insights.recoveryExpired')
      return
    }
    // An uncertain POST is retried only by explicit action with the same UUID and period.
    try { writePendingIntent(storageKey, { payload: { request: body, jobId: null }, createdAt: started, idempotencyKey: body.clientRequestId }) }
    catch { setStorageError('insights.recoveryBeforeSendFailed'); return }
    requestedAt.current = started
    submitting.current = true
    setRequest(body)
    setPreviewId(null)
    setJobId(null)
    mutation.mutate(body)
  }

  function forgetReference() {
    try { sessionStorage.removeItem(storageKey) }
    catch { setStorageError('insights.recoveryRemoveFailed'); return }
    setConfirmDiscard(false)
    setRequest(null)
    setJobId(null)
    requestedAt.current = null
    setStorageError(null)
    mutation.reset()
  }

  const sendingOrBusy = mutation.isPending || busy(activeJob) || busy(job) || recovering
  const loading = viewingPreview ? previewQuery.isPending : mutation.isPending || recovering || busy(activeJob)
  const failedQuery = viewingPreview && previewQuery.isError ? previewQuery : requestQuery

  // Keep the hooks mounted when TabsContent hides its children, without polling the hidden tab.
  return <TabsContent value="insights">
    <section className="min-w-0 space-y-5 text-foreground" aria-label={t('insights.title')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('insights.title')}</h2>
        <Button onClick={generate} disabled={blocked} className="gap-2" aria-describedby="insights-notice">
          {sendingOrBusy
            ? <RefreshCw size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            : <Sparkles size={16} aria-hidden="true" />}
          {t(mutation.isPending ? 'insights.sending' : recovering ? 'insights.recovering' : busy(activeJob) || busy(job) ? 'insights.busy' : !jobId && request ? 'insights.resend' : 'insights.create')}
        </Button>
      </div>
      <p id="insights-notice" className="text-sm text-muted-foreground">{t('insights.notice')}</p>
      <div className="space-y-1 text-sm">
        <p className="break-words">{t('insights.period', { from: rangeError ? from : time(from), to: rangeError ? to : time(to) })}</p>
        {request && (!job || viewingPreview || busy(activeJob) || request.from !== from || request.to !== to) &&
          <p className="break-words">{t('insights.requestPeriod', { from: time(request.from), to: time(request.to) })}</p>}
      </div>
      {rangeError && <p role="alert" className="text-sm text-destructive">{rangeError}</p>}
      {!canGenerate && <p role="status" className="text-sm text-muted-foreground">{t('insights.noGenerate')}</p>}
      {config.isPending && <p role="status">{t('insights.configLoading')}</p>}
      {config.data?.enabled === false && <p role="status" className="text-sm">{t('insights.disabled')}</p>}
      <div className="space-y-1 text-xs text-muted-foreground">
        {config.data && <p>{t('insights.retention', { days: config.data.retentionDays, maxDays: config.data.maxRangeDays })}</p>}
        {canGenerate && <p>{t('insights.createWarning')}</p>}
      </div>
      {config.isError && <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-destructive">{insightError(config.error)}</p>
        <Button variant="outline" disabled={!tracking || config.isFetching} onClick={() => void config.refetch()} className="gap-2">
          <RefreshCw size={16} aria-hidden="true" />{t('insights.configReload')}
        </Button>
      </div>}
      {mutation.isError && <p role="alert" className="text-sm text-destructive">{insightError(mutation.error)} {t('insights.retryNotice')}</p>}
      {!jobId && request && !mutation.isPending && !mutation.isError && <p role="status" className="text-sm">{t('insights.unconfirmed')}</p>}
      {storageError && <p role="alert" className="text-sm text-destructive">{t(storageError)}</p>}
      {!mutation.isPending && !busy(activeJob) && (storageError || requestQuery.error instanceof ApiError && requestQuery.error.status === 404) &&
        <Button variant="outline" onClick={() => setConfirmDiscard(true)}>{t('insights.discard')}</Button>}
      {viewingPreview && (request || jobId || storageError) && <div className="space-y-2 border-y border-border py-3">
        <p role="status" className="text-sm text-muted-foreground">{t('insights.trackingRequest')}</p>
        <Button variant="outline" className="gap-2" onClick={() => setPreviewId(null)}>
          <ArrowLeft size={16} aria-hidden="true" />{t('insights.returnToRequest')}
        </Button>
      </div>}
      {loading && <div className="space-y-3 border-t border-border py-4" aria-busy="true" aria-label={t('insights.loadingLabel')}>
        <p role="status" className="text-sm">{t(viewingPreview || recovering ? 'insights.loadSaved' : mutation.isPending ? 'insights.sendStatus' : activeJob?.status === 'QUEUED' ? 'insights.waiting' : 'insights.processing')}</p>
        <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
          <div className="h-4 w-2/3 rounded bg-muted" /><div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" /><div className="h-16 rounded bg-muted" />
        </div>
      </div>}
      {failedQuery.isError && <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-destructive">{insightError(failedQuery.error)} {t('insights.lastKnown')}</p>
        <Button variant="outline" disabled={!tracking || failedQuery.isFetching} onClick={() => void failedQuery.refetch()} className="gap-2">
          <RefreshCw size={16} aria-hidden="true" />{t('insights.refreshStatus')}
        </Button>
      </div>}
      {job && <BusinessInsightResult key={job.id} job={job} />}
      <BusinessInsightHistory employeeId={employeeId} enabled={tracking} selectedId={viewingPreview ? previewId : jobId}
        onSelect={item => setPreviewId(item.id === jobId ? null : item.id)} />
    </section>
    <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} maxWidth="sm">
      <DialogHeader>
        <DialogTitle>{t('insights.discardTitle')}</DialogTitle>
        <DialogDescription>{t('insights.discardDescription')}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setConfirmDiscard(false)}>{t('insights.keep')}</Button>
        <Button onClick={forgetReference}>{t('insights.confirmDiscard')}</Button>
      </DialogFooter>
    </Dialog>
  </TabsContent>
}
