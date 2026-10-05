import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Copy, QrCode, RefreshCw, RotateCw, Ban, Check } from 'lucide-react'
import type { Session } from '../../auth/session'
import { Button, Input } from '../../../shared/ui'
import { PaymentQr } from '../../../shared/ui/payment-qr'
import { errorMessage } from '../../../shared/api/client'
import { collectPickupItem, getPickupStatus, issuePickupCode, parsePickupLink, pickupLink, revokePickupCode, rotatePickupCode, type PickupCredential } from '../pickup.api'

export function PickupCodePanel({ invoiceId }: { invoiceId: string }) {
  const { authorization } = useOutletContext<Session>()
  const [issued, setIssued] = useState<(PickupCredential & { expiresAt: string }) | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const canChange = authorization.permissionKeys.includes('/invoices_update')
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async (action: 'issue' | 'rotate' | 'revoke') => {
      if (action === 'revoke') { await revokePickupCode(issued!); return null }
      return action === 'rotate' ? rotatePickupCode(issued!) : issuePickupCode(invoiceId)
    },
    onSuccess: (value) => { setIssued(value); setCopied(false); setCopyError(false) },
    onError: () => { setIssued(null) },
  })
  return <section aria-label="Mã nhận hàng" className="space-y-3 border-b border-border px-5 py-4">
    <h4 className="font-semibold">Mã nhận hàng</h4>
    {mutation.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
    {!issued ? <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate('issue')}><QrCode size={16} />Lấy liên kết nhận hàng</Button> : <>
      <PaymentQr value={pickupLink(issued)} label="Mã QR nhận hàng" />
      <p className="text-sm">Hết hạn: {new Date(issued.expiresAt).toLocaleString('vi-VN')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={mutation.isPending} onClick={() => {
          void navigator.clipboard.writeText(pickupLink(issued)).then(() => setCopied(true)).catch(() => setCopyError(true))
        }}><Copy size={16} />{copied ? 'Đã sao chép' : 'Sao chép liên kết riêng'}</Button>
        {canChange && <>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => { if (window.confirm('Đổi mã và vô hiệu hóa liên kết cũ?')) mutation.mutate('rotate') }}><RotateCw size={16} />Đổi mã</Button>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => { if (window.confirm('Thu hồi liên kết nhận hàng?')) mutation.mutate('revoke') }}><Ban size={16} />Thu hồi</Button>
        </>}
      </div>
      {copyError && <p role="alert">Không thể sao chép liên kết.</p>}
    </>}
  </section>
}

export function PickupCollectionPanel() {
  const { employee } = useOutletContext<Session>()
  const [value, setValue] = useState('')
  const [credential, setCredential] = useState<PickupCredential | null>(null)
  const [verification, setVerification] = useState(0)
  const [invalid, setInvalid] = useState(false)
  const client = useQueryClient()
  const status = useQuery({
    queryKey: ['private', employee.id, 'pickup-collection', credential?.invoiceId, verification], enabled: Boolean(credential), staleTime: 0, gcTime: 0,
    queryFn: ({ signal }) => getPickupStatus(credential!, signal),
  })
  const collect = useMutation({
    mutationFn: (id: string) => collectPickupItem(credential!, id),
    onSettled: () => {
      void status.refetch()
      void client.invalidateQueries({ queryKey: ['online-orders'] })
    },
  })
  return <section aria-label="Bàn giao bằng mã nhận hàng" className="space-y-3 border-y border-border py-4">
    <h2 className="text-lg font-semibold">Bàn giao bằng mã nhận hàng</h2>
    <form className="flex flex-wrap gap-2" onSubmit={(event) => {
      event.preventDefault(); const parsed = parsePickupLink(value); setInvalid(!parsed)
      if (parsed) { setCredential(parsed); setVerification(value => value + 1); collect.reset() }
    }}>
      <Input aria-label="Liên kết nhận hàng" type="password" autoComplete="off" value={value} disabled={collect.isPending} onChange={(event) => { setValue(event.target.value); setCredential(null); collect.reset() }} className="min-w-0 flex-1" />
      <Button type="submit" disabled={!value.trim() || collect.isPending}><QrCode size={16} />Kiểm tra</Button>
    </form>
    {invalid && <p role="alert">Liên kết nhận hàng không hợp lệ.</p>}
    {status.isFetching && <p role="status">Đang kiểm tra…</p>}
    {status.isError && <p role="alert">{errorMessage(status.error)}</p>}
    {collect.isError && <p role="alert">{errorMessage(collect.error)} Kiểm tra trạng thái trước khi bàn giao lại.</p>}
    {credential && status.data && !status.isError && <>
      <Button variant="outline" disabled={status.isFetching || collect.isPending} onClick={() => { collect.reset(); void status.refetch() }}><RefreshCw size={16} />Kiểm tra lại</Button>
      <ul className="divide-y divide-border">{status.data.items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span>{item.quantity} × {item.name}</span>
        {item.serveStatus === 'SERVED' ? <span>Đã nhận</span> : <Button size="sm" disabled={item.serveStatus !== 'READY' || collect.isPending || status.isFetching || collect.isError}
          onClick={() => { if (window.confirm('Bàn giao toàn bộ ' + item.quantity + ' × ' + item.name + '?')) collect.mutate(item.id) }}><Check size={16} />Bàn giao</Button>}
      </li>)}</ul>
    </>}
  </section>
}
