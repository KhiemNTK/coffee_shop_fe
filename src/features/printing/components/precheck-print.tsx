import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import type { Session } from '../../auth/session'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { Button } from '../../../shared/ui'
import { printingApi, printingKeys, type CreatePrecheckDto } from '../printing.api'

export function PrecheckPrint({
  input,
  disabled = false,
}: {
  input: CreatePrecheckDto
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const client = useQueryClient()
  const flight = useRef(false)
  const [uncertain, setUncertain] = useState(false)
  const print = useMutation({
    mutationFn: printingApi.createPrecheck,
    retry: false,
    onSuccess: () => {
      setUncertain(false)
      void client.invalidateQueries({ queryKey: printingKeys.jobs(employee.id) })
    },
    onError: (error) =>
      setUncertain(
        (previous) =>
          previous ||
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 408 &&
            error.status !== 429
          ),
      ),
    onSettled: () => {
      flight.current = false
    },
  })
  if (!access.has('/invoices_create')) return null
  return (
    <div className="min-w-0 space-y-2 text-sm">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || print.isPending}
        isLoading={print.isPending}
        onClick={() => {
          if (flight.current || disabled) return
          const request = uncertain ? print.variables : input
          if (!request) return
          flight.current = true
          print.mutate(request)
        }}
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
        {t(uncertain ? 'precheck.retry' : 'precheck.print')}
      </Button>
      {print.isError && (
        <p role="alert" className="max-w-sm break-words text-destructive">
          {errorMessage(print.error)}
        </p>
      )}
      {uncertain && (
        <p className="max-w-sm text-muted-foreground">
          {t('precheck.uncertain')}
        </p>
      )}
      {print.isSuccess && (
        <p role="status" className="max-w-sm text-muted-foreground">
          {t('precheck.queued')}
          {!print.data.deviceId && ` ${t('precheck.noPrinter')}`}
        </p>
      )}
    </div>
  )
}
