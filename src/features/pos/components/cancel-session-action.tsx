import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import type { Session } from '../../auth/session'
import { cancelSession, type SessionDetail } from '../pos.api'
import { posKeys } from '../pos.keys'
import { errorMessage } from '../../../shared/api/client'
import { Button, Dialog, DialogTitle, DialogDescription, DialogFooter } from '../../../shared/ui'

export function CancelSessionAction({
  session,
  disabled,
}: {
  session: SessionDetail
  disabled: boolean
}) {
  const { t: translate } = useTranslation()
  const [open, setOpen] = useState(false)
  const { employee, access } = useOutletContext<Session>()
  const client = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: () => cancelSession(session.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKeys.tables(employee.id) })
      void client.invalidateQueries({ queryKey: posKeys.sessions(employee.id) })
      void client.invalidateQueries({
        queryKey: posKeys.session(employee.id, session.id),
      })
      navigate('/staff/pos')
    },
  })
  if (
    !access.has('/orders_sessions_cancel') ||
    session.sessionStatus !== 'ACTIVE' ||
    session.onlineOrderRequest
  )
    return null
  const blocked = session.orderItems.some(
    (item) =>
      item.isPaid || item.invoiceId || ['COOKING', 'READY', 'SERVED'].includes(item.serveStatus),
  )
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || blocked}
        title={blocked ? translate('pos.cannotCancel') : translate('pos.cancelSession')}
        onClick={() => {
          mutation.reset()
          setOpen(true)
        }}
      >
        <Trash2 size={16} />
        {translate('pos.cancelSession')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) setOpen(value)
        }}
      >
        <DialogTitle>{translate('pos.cancelSessionHeading')}</DialogTitle>
        <DialogDescription>{translate('pos.cancelSessionInfo')}</DialogDescription>
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
            variant="destructive"
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Trash2 size={16} />
            {translate('pos.confirmCancelSession')}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
