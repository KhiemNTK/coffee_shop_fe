import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import type { Session } from '../../auth/session'
import { completeSession, type SessionDetail } from '../pos.api'
import { posKeys } from '../pos.keys'
import { errorMessage } from '../../../shared/api/client'
import { Button, Dialog, DialogTitle, DialogDescription, DialogFooter } from '../../../shared/ui'

export function CompleteSessionAction({
  session,
  disabled,
}: {
  session: SessionDetail
  disabled: boolean
}) {
  const { t: translate } = useTranslation()
  const [open, setOpen] = useState(false)
  const flight = useRef(false)
  const { employee, authorization } = useOutletContext<Session>()
  const client = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: () => completeSession(session.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: posKeys.tables(employee.id) })
      await client.invalidateQueries({ queryKey: posKeys.sessions(employee.id) })
      await client.invalidateQueries({ queryKey: posKeys.session(employee.id, session.id) })
      navigate('/staff/pos')
    },
    onSettled: () => {
      flight.current = false
    },
  })
  if (
    !session.table ||
    session.sessionStatus !== 'ACTIVE' ||
    !authorization.permissionKeys.includes('/orders_tables_clear')
  )
    return null
  const unfinished = session.orderItems.some(
    (item) => item.serveStatus !== 'CANCELLED' && (!item.isPaid || item.serveStatus !== 'SERVED'),
  )
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || unfinished || mutation.isPending}
        title={unfinished ? translate('pos.unfinished') : translate('pos.complete')}
        onClick={() => {
          mutation.reset()
          setOpen(true)
        }}
      >
        <CheckCircle2 size={16} /> {translate('pos.complete')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!flight.current) setOpen(value)
        }}
      >
        <DialogTitle>
          {translate('pos.completePrefix')} {session.table.name}?
        </DialogTitle>
        <DialogDescription>{translate('pos.completeInfo')}</DialogDescription>
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(mutation.error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>
            {translate('common.back')}
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={disabled || unfinished}
            onClick={() => {
              if (flight.current || disabled || unfinished) return
              flight.current = true
              mutation.mutate()
            }}
          >
            <CheckCircle2 size={16} /> {translate('pos.confirmGuestsLeft')}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
