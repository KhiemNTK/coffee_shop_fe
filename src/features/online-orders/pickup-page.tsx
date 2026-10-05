import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { RefreshCw, Send } from 'lucide-react'
import { Button, Textarea } from '../../shared/ui'
import { errorMessage } from '../../shared/api/client'
import { getPickupStatus, parsePickupLink, submitPickupFeedback } from './pickup.api'

const labels = { PREPARING: 'Đang chuẩn bị', PARTIALLY_READY: 'Một phần đã sẵn sàng', READY: 'Sẵn sàng nhận tại quán', COLLECTED: 'Đã nhận món' }

export default function PickupPage() {
  const [credential] = useState(() => parsePickupLink(window.location.href))
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const status = useQuery({
    queryKey: ['pickup-status', credential?.invoiceId], enabled: Boolean(credential), gcTime: 0, staleTime: 0,
    queryFn: ({ signal }) => getPickupStatus(credential!, signal),
    refetchInterval: (query) => query.state.error || query.state.data?.status === 'COLLECTED' ||
      (query.state.data && Date.parse(query.state.data.expiresAt) <= Date.now()) ? false : 15_000,
  })
  const feedback = useMutation({ mutationFn: () => submitPickupFeedback(credential!, rating, comment), gcTime: 0 })
  return <main className="mx-auto min-h-dvh max-w-2xl space-y-6 px-4 py-8">
    <Link to="/" className="text-sm underline">Thực đơn</Link>
    <h1 className="text-2xl font-bold">Nhận món mang đi</h1>
    {!credential ? <p role="alert">Liên kết nhận món không hợp lệ.</p> : <>
      {status.isPending && <p role="status">Đang kiểm tra đơn…</p>}
      {status.isError && <p role="alert">{errorMessage(status.error)}</p>}
      <Button variant="outline" disabled={status.isFetching} onClick={() => void status.refetch()}><RefreshCw size={16} /> Làm mới trạng thái</Button>
      {status.data && <section className="space-y-3" aria-label="Trạng thái nhận món">
        <h2 className="text-lg font-semibold">{labels[status.data.status]}</h2>
        {status.isError && <p className="text-amber-800">Trạng thái bên dưới là lần kiểm tra trước.</p>}
        <ul className="divide-y divide-border">{status.data.items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3">
          <span>{item.quantity} × {item.name}</span><span>{item.serveStatus === 'SERVED' ? 'Đã nhận' : item.serveStatus === 'READY' ? 'Sẵn sàng' : 'Đang chuẩn bị'}</span>
        </li>)}</ul>
        <p className="text-sm text-muted-foreground">Mã hết hạn: {new Date(status.data.expiresAt).toLocaleString('vi-VN')}</p>
      </section>}
      {status.data?.status === 'COLLECTED' && !status.isError && <section className="space-y-3 border-t border-border pt-5">
        <h2 className="text-lg font-semibold">Đánh giá đơn hàng</h2>
        {feedback.isSuccess ? <p role="status">Cảm ơn bạn đã đánh giá.</p> : <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); feedback.mutate() }}>
          <fieldset disabled={feedback.isPending || feedback.isError} className="space-y-3">
            <legend className="text-sm">Mức hài lòng</legend>
            <div className="flex flex-wrap gap-3">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="flex min-h-11 items-center gap-1.5"><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} />{value}/5</label>)}</div>
            <label className="block text-sm">Nhận xét<Textarea value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} /></label>
          </fieldset>
          {feedback.isError && <p role="alert">{errorMessage(feedback.error)} Nhận xét được giữ nguyên khi gửi lại.</p>}
          <Button disabled={feedback.isPending} type="submit"><Send size={16} />{feedback.isError ? 'Gửi lại cùng đánh giá' : 'Gửi đánh giá'}</Button>
        </form>}
      </section>}
    </>}
  </main>
}
