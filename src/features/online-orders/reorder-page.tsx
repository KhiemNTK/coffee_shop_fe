import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getReorderTemplate, createOnlineOrder, revokeReorderKey, type CreateOnlineOrderPayload } from './online-orders.api'
import { ApiError, errorMessage } from '../../shared/api/client'
import { findPendingOperationKey } from '../../shared/api/idempotency'
import { OrderTrackingView } from './components/order-tracking-view'
import { formatPrice } from '../../shared/lib/format'
import { Button, Input } from '../../shared/ui'
import { authConfig } from '../auth/auth.config'
import { Turnstile } from '../auth/turnstile'

export default function ReorderPage() {
  const initial = new URLSearchParams(window.location.hash.slice(1))
  const [requestId, setRequestId] = useState(() => initial.get('requestId') ?? '')
  const [reorderToken, setReorderToken] = useState(() => initial.get('key') ?? '')
  const [captcha, setCaptcha] = useState('')
  const [captchaAttempt, setCaptchaAttempt] = useState(0)
  const [submitted, setSubmitted] = useState<CreateOnlineOrderPayload | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState(false)
  const flight = useRef(false)
  const uncertain = useRef(false)
  const navigate = useNavigate()
  const template = useMutation({ mutationFn: () => getReorderTemplate(requestId.trim(), reorderToken.trim()) })
  const revoke = useMutation({ mutationFn: () => revokeReorderKey(requestId.trim(), reorderToken.trim()),
    onSuccess: () => { template.reset(); setReorderToken(''); window.history.replaceState(window.history.state, '', '/reorder') } })
  const order = useMutation({
    mutationFn: (payload: CreateOnlineOrderPayload) => createOnlineOrder(payload),
    onSuccess: (result) => {
      try { sessionStorage.setItem('coffee_shop_takeaway_order', JSON.stringify({ requestId: result.requestId, accessToken: result.accessToken })) }
      catch { setStorageWarning(true); return }
      navigate('/order')
    },
    onError: (error) => {
      if (!uncertain.current && error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429)
        setSubmitted(null)
      else uncertain.current = true
    },
    onSettled: () => { flight.current = false; setCaptcha(''); setCaptchaAttempt((attempt) => attempt + 1) },
  })
  const unavailable = import.meta.env.PROD && !authConfig.turnstileSiteKey
  const locked = order.isPending || Boolean(submitted)
  async function submit(values: FormData) {
    if (flight.current || unavailable || !template.data?.quote.canSubmit || (authConfig.turnstileSiteKey && !captcha)) return
    flight.current = true
    setFormError(null)
    const payload = submitted ?? {
      pickupName: String(values.get('name')).trim(), phoneNumber: String(values.get('phone')).trim(),
      items: template.data.items, maxSubtotal: template.data.quote.currentSubtotal!,
    }
    try {
      const pendingKey = await findPendingOperationKey('/online-orders/requests', { ...payload }, false)
      uncertain.current ||= Boolean(pendingKey)
      const intent = { ...payload, clientRequestId: pendingKey ?? payload.clientRequestId ?? crypto.randomUUID() }
      setSubmitted(intent)
      order.mutate({ ...intent, ...(captcha ? { turnstileToken: captcha } : {}) })
    } catch (error) { setFormError(errorMessage(error)); flight.current = false }
  }
  if (storageWarning && order.data) return <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
    <p role="alert">Đơn đã được gửi nhưng trình duyệt không lưu được thông tin theo dõi. Không đóng tab trước khi ghi lại mã đơn.</p>
    <OrderTrackingView orderAuth={order.data} onNewOrder={() => navigate('/order')} />
  </main>
  return <main className="mx-auto max-w-xl space-y-5 px-4 py-8">
    <Link to="/" className="font-semibold text-primary">Coffee Shop</Link>
    <h1 className="text-2xl font-bold">Đặt lại đơn cũ</h1>
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (!flight.current && !locked && !template.isPending && !revoke.isPending) template.mutate() }}>
      <label className="block text-sm">Mã đơn<Input value={requestId} required disabled={locked || template.isPending || revoke.isPending} onChange={(event) => { setRequestId(event.target.value); template.reset() }} /></label>
      <label className="block text-sm">Khóa đặt lại<Input value={reorderToken} required type="password" autoComplete="off" pattern="[0-9a-f]{64}" disabled={locked || template.isPending || revoke.isPending}
        onChange={(event) => { setReorderToken(event.target.value); template.reset() }} /></label>
      <Button type="submit" isLoading={template.isPending} disabled={locked || revoke.isPending}>Kiểm tra đơn và giá hiện tại</Button>
    </form>
    {(template.error || order.error || revoke.error) && <p role="alert" className="text-sm text-destructive">{errorMessage(template.error || order.error || revoke.error)}</p>}
    {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
    {submitted && !order.isPending && <p role="status">Chưa xác nhận được đơn. Gửi lại cùng nội dung để kiểm tra kết quả; không tạo đơn khác.</p>}
    {template.data && <section className="space-y-4 border-t border-border pt-4">
      <ul className="space-y-2">{template.data.quote.lines.map((line, index) => <li key={line.lineNumber} className="border-b border-border py-2 text-sm">
        <p>{line.currentName ?? line.previousName} × {template.data?.items[index]?.quantity}</p>
        <p>{line.available ? formatPrice(line.currentUnitPrice) : 'Món hoặc tùy chọn đã ngừng bán'}</p>
        {line.currentUnitPrice !== line.previousUnitPrice && <p>Giá trước: {formatPrice(line.previousUnitPrice)}</p>}
      </li>)}</ul>
      {template.data.quote.canSubmit ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)) }}>
        <p className="font-semibold">Tổng hiện tại: {formatPrice(template.data.quote.currentSubtotal)}</p>
        <label className="block text-sm">Tên người nhận<Input name="name" minLength={2} maxLength={80} required autoComplete="name" disabled={locked} /></label>
        <label className="block text-sm">Điện thoại<Input name="phone" type="tel" autoComplete="tel" pattern="[+]?[0-9]{8,15}" required disabled={locked} /></label>
        {authConfig.turnstileSiteKey && <Turnstile key={captchaAttempt} siteKey={authConfig.turnstileSiteKey} action="online_order" onToken={setCaptcha} />}
        {unavailable && <p role="alert">Đặt món chưa sẵn sàng. Vui lòng liên hệ cửa hàng.</p>}
        <Button type="submit" isLoading={order.isPending} disabled={unavailable || template.isPending || revoke.isPending || Boolean(authConfig.turnstileSiteKey && !captcha)}>{submitted ? 'Kiểm tra lại đơn đã gửi' : 'Đặt lại · Trả khi nhận'}</Button>
      </form> : <Link to="/order" className="font-semibold text-primary">Chọn món khác</Link>}
      <Button variant="outline" isLoading={revoke.isPending} disabled={locked || template.isPending} onClick={() => {
        if (!flight.current && window.confirm('Thu hồi khóa đặt lại của đơn này?')) revoke.mutate()
      }}>Thu hồi khóa đặt lại</Button>
    </section>}
  </main>
}
