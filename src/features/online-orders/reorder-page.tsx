import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getReorderTemplate, createOnlineOrder, revokeReorderKey } from './online-orders.api'
import { errorMessage } from '../../shared/api/client'
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
  const navigate = useNavigate()
  const template = useMutation({ mutationFn: () => getReorderTemplate(requestId.trim(), reorderToken.trim()) })
  const revoke = useMutation({ mutationFn: () => revokeReorderKey(requestId.trim(), reorderToken.trim()),
    onSuccess: () => { template.reset(); setReorderToken(''); window.history.replaceState(window.history.state, '', '/reorder') } })
  const order = useMutation({
    mutationFn: (values: FormData) => createOnlineOrder({
      pickupName: String(values.get('name')).trim(), phoneNumber: String(values.get('phone')).trim(),
      items: template.data!.items, maxSubtotal: template.data!.quote.currentSubtotal!,
      ...(captcha ? { turnstileToken: captcha } : {}),
    }),
    onSuccess: (result) => {
      sessionStorage.setItem('coffee_shop_takeaway_order', JSON.stringify({ requestId: result.requestId, accessToken: result.accessToken }))
      navigate('/order')
    },
    onSettled: () => { setCaptcha(''); setCaptchaAttempt((attempt) => attempt + 1) },
  })
  const unavailable = import.meta.env.PROD && !authConfig.turnstileSiteKey
  return <main className="mx-auto max-w-xl space-y-5 px-4 py-8">
    <Link to="/" className="font-semibold text-primary">Coffee Shop</Link>
    <h1 className="text-2xl font-bold">Đặt lại đơn cũ</h1>
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (!template.isPending) template.mutate() }}>
      <label className="block text-sm">Mã đơn<Input value={requestId} required disabled={order.isPending || template.isPending || revoke.isPending} onChange={(event) => { setRequestId(event.target.value); template.reset() }} /></label>
      <label className="block text-sm">Khóa đặt lại<Input value={reorderToken} required type="password" autoComplete="off" pattern="[0-9a-f]{64}" disabled={order.isPending || template.isPending || revoke.isPending}
        onChange={(event) => { setReorderToken(event.target.value); template.reset() }} /></label>
      <Button type="submit" isLoading={template.isPending} disabled={order.isPending}>Kiểm tra đơn và giá hiện tại</Button>
    </form>
    {(template.error || order.error || revoke.error) && <p role="alert" className="text-sm text-destructive">{errorMessage(template.error || order.error || revoke.error)}</p>}
    {template.data && <section className="space-y-4 border-t border-border pt-4">
      <ul className="space-y-2">{template.data.quote.lines.map((line, index) => <li key={line.lineNumber} className="border-b border-border py-2 text-sm">
        <p>{line.currentName ?? line.previousName} × {template.data?.items[index]?.quantity}</p>
        <p>{line.available ? formatPrice(line.currentUnitPrice) : 'Món hoặc tùy chọn đã ngừng bán'}</p>
        {line.currentUnitPrice !== line.previousUnitPrice && <p>Giá trước: {formatPrice(line.previousUnitPrice)}</p>}
      </li>)}</ul>
      {template.data.quote.canSubmit ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (!order.isPending && !unavailable) order.mutate(new FormData(event.currentTarget)) }}>
        <p className="font-semibold">Tổng hiện tại: {formatPrice(template.data.quote.currentSubtotal)}</p>
        <label className="block text-sm">Tên người nhận<Input name="name" minLength={2} maxLength={80} required autoComplete="name" disabled={order.isPending} /></label>
        <label className="block text-sm">Điện thoại<Input name="phone" type="tel" autoComplete="tel" pattern="[+]?[0-9]{8,15}" required disabled={order.isPending} /></label>
        {authConfig.turnstileSiteKey && <Turnstile key={captchaAttempt} siteKey={authConfig.turnstileSiteKey} action="online_order" onToken={setCaptcha} />}
        {unavailable && <p role="alert">Đặt món chưa sẵn sàng. Vui lòng liên hệ cửa hàng.</p>}
        <Button type="submit" isLoading={order.isPending} disabled={unavailable || Boolean(authConfig.turnstileSiteKey && !captcha)}>Đặt lại · Trả khi nhận</Button>
      </form> : <Link to="/order" className="font-semibold text-primary">Chọn món khác</Link>}
      <Button variant="outline" isLoading={revoke.isPending} disabled={order.isPending} onClick={() => {
        if (window.confirm('Thu hồi khóa đặt lại của đơn này?')) revoke.mutate()
      }}>Thu hồi khóa đặt lại</Button>
    </section>}
  </main>
}
