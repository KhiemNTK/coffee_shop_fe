import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { apiMutate, errorMessage } from '../../shared/api/client'
import { clearIdentity, announceSessionChange } from '../../app/query-client'
import { Button, Input } from '../../shared/ui'
import { authConfig } from './auth.config'
import { Turnstile } from './turnstile'

export default function PasswordRecoveryPage() {
  const location = useLocation()
  const resetting = location.pathname.includes('reset-password')
  const [resetToken] = useState(() => new URLSearchParams(location.search).get('token') ?? '')
  const [captcha, setCaptcha] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const unavailable = !resetting && import.meta.env.PROD && !authConfig.turnstileSiteKey

  useEffect(() => {
    if (resetting && location.search) window.history.replaceState(window.history.state, '', location.pathname)
  }, [resetting, location.pathname, location.search])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || unavailable) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const password = String(fields.get('password') ?? '')
    if (resetting && (password.length < 12 || new TextEncoder().encode(password).length > 72 ||
      password !== fields.get('confirmation'))) {
      setError('Mật khẩu cần ít nhất 12 ký tự, tối đa 72 byte và xác nhận trùng khớp.')
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }
    submitting.current = true
    setPending(true)
    setError(null)
    try {
      await apiMutate(
        resetting ? '/auth/reset-password' : '/auth/forgot-password',
        'POST', z.object({ message: z.string() }),
        resetting ? { token: resetToken, password }
          : { email: String(fields.get('email')).trim(), ...(captcha ? { turnstileToken: captcha } : {}) },
        undefined, false,
      )
      if (resetting) { clearIdentity(); announceSessionChange() }
      form.reset()
      setDone(true)
    } catch (failure) {
      setError(errorMessage(failure))
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      submitting.current = false
      setPending(false)
      setCaptcha('')
      setAttempt((value) => value + 1)
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-12">
      <Link to="/" className="font-semibold text-primary">Coffee Shop</Link>
      <h1 className="text-2xl font-bold">{resetting ? 'Đặt lại mật khẩu' : 'Quên mật khẩu'}</h1>
      {done ? (
        <p role="status">{resetting ? 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.'
          : 'Nếu tài khoản hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi tới email.'}</p>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {resetting ? (
            <>
              <label className="block space-y-1"><span>Mật khẩu mới</span>
                <Input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required disabled={pending} />
              </label>
              <label className="block space-y-1"><span>Xác nhận mật khẩu</span>
                <Input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={72} required disabled={pending} />
              </label>
              {!resetToken && <p role="alert">Liên kết đặt lại mật khẩu không hợp lệ.</p>}
            </>
          ) : (
            <>
              <label className="block space-y-1"><span>Email nhân viên</span>
                <Input name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} />
              </label>
              {authConfig.turnstileSiteKey && <Turnstile key={attempt} siteKey={authConfig.turnstileSiteKey} action="password_reset" onToken={setCaptcha} />}
            </>
          )}
          {unavailable && <p role="alert">Khôi phục tài khoản chưa sẵn sàng. Vui lòng liên hệ quản lý.</p>}
          {error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" isLoading={pending} disabled={unavailable || (resetting ? !resetToken : Boolean(authConfig.turnstileSiteKey && !captcha))}>
            {resetting ? 'Đổi mật khẩu' : 'Gửi hướng dẫn'}
          </Button>
        </form>
      )}
      <Link to="/sign-in" className="block text-sm font-semibold text-primary">Về đăng nhập</Link>
    </main>
  )
}
