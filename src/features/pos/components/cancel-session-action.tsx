import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import type { Session } from '../../auth/session'
import { cancelSession, type SessionDetail } from '../pos.api'
import { posKeys } from '../pos.keys'
import { errorMessage } from '../../../shared/api/client'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../shared/ui'

export function CancelSessionAction({
  session,
  disabled,
}: {
  session: SessionDetail
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const { employee, authorization } = useOutletContext<Session>()
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
    !authorization.permissionKeys.includes('/orders_sessions_cancel') ||
    session.sessionStatus !== 'ACTIVE' ||
    session.onlineOrderRequest
  )
    return null
  const blocked = session.orderItems.some(
    (item) =>
      item.isPaid ||
      item.invoiceId ||
      ['COOKING', 'READY', 'SERVED'].includes(item.serveStatus),
  )
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || blocked}
        title={
          blocked ? 'Phiên có món đã xử lý hoặc đã lập hóa đơn' : 'Hủy phiên'
        }
        onClick={() => {
          mutation.reset()
          setOpen(true)
        }}
      >
        <Trash2 size={16} />
        Hủy phiên
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) setOpen(value)
        }}
      >
        <DialogTitle>Hủy phiên phục vụ?</DialogTitle>
        <DialogDescription>
          Hủy toàn bộ món chưa xử lý và trả bàn về trạng thái trống.
        </DialogDescription>
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(mutation.error)}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => setOpen(false)}
          >
            Quay lại
          </Button>
          <Button
            variant="destructive"
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Trash2 size={16} />
            Xác nhận hủy phiên
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
