import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { issueReorderKey } from '../online-orders.api'
import { errorMessage } from '../../../shared/api/client'
import { Button, Input } from '../../../shared/ui'

export function ReorderLink({ requestId, accessToken }: { requestId: string; accessToken: string }) {
  const key = useMutation({ mutationFn: () => issueReorderKey(requestId, accessToken) })
  const url = key.data ? `${window.location.origin}/reorder#requestId=${encodeURIComponent(requestId)}&key=${encodeURIComponent(key.data.reorderToken)}` : ''
  return <section className="space-y-2 border-t border-border pt-4">
    <Button variant="outline" isLoading={key.isPending} onClick={() => key.mutate()}>Tạo liên kết đặt lại đơn</Button>
    {key.error && <p role="alert" className="text-sm text-destructive">{errorMessage(key.error)}</p>}
    {key.data && <>
      <label className="block text-sm">Liên kết riêng tư · Hết hạn {new Date(key.data.expiresAt).toLocaleDateString('vi-VN')}
        <Input readOnly value={url} onFocus={(event) => event.target.select()} />
      </label>
      <Link to={url.slice(window.location.origin.length)} className="block text-sm font-semibold text-primary">Đặt lại đơn này</Link>
    </>}
  </section>
}
