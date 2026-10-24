import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, Copy } from 'lucide-react'
import { ApiError, errorMessage } from '../api/client'
import { useRetryAfter } from '../api/use-retry-after'
import { Button } from './button'

export function ApiErrorAlert({ error }: { error: unknown }) {
  const { t } = useTranslation()
  const retryWait = useRetryAfter(error)
  const [copyResult, setCopyResult] = useState<{ requestId: string; status: 'copied' | 'failed' }>()
  const requestId = error instanceof ApiError ? error.requestId : undefined
  const copyState = copyResult?.requestId === requestId ? copyResult?.status : undefined
  return (
    <div
      role="alert"
      className="flex min-w-0 items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="break-words">
          {typeof error === 'string'
            ? error
            : error instanceof ApiError && error.status === 429
              ? t('error.rateLimit')
              : errorMessage(error)}
        </p>
        {retryWait > 0 && <p aria-live="off">{t('error.retryWait', { seconds: retryWait })}</p>}
        {requestId && (
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <div className="min-w-0 flex-1">
              <span>{t('common.supportId')}</span>{' '}
              <code className="select-all break-all">{requestId}</code>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={t('common.copySupportId')}
              title={t('common.copySupportId')}
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(requestId)
                  .then(() => setCopyResult({ requestId, status: 'copied' }))
                  .catch(() => setCopyResult({ requestId, status: 'failed' }))
                if (!navigator.clipboard) setCopyResult({ requestId, status: 'failed' })
              }}
            >
              {copyState === 'copied' ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
            </Button>
          </div>
        )}
        {copyState && (
          <p role="status" className="text-xs">
            {t(copyState === 'copied' ? 'common.supportIdCopied' : 'common.supportIdCopyFailed')}
          </p>
        )}
      </div>
    </div>
  )
}
