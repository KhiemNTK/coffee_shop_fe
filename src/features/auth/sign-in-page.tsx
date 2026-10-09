import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Coffee, Eye, EyeOff, LogIn } from 'lucide-react'
import { authCommand, ApiError, errorMessage } from '../../shared/api/client'
import { announceSessionChange, clearIdentity } from '../../app/query-client'
import { Turnstile } from './turnstile'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { buttonVariants } from '../../shared/ui/button-variants'
import { Input } from '../../shared/ui/input'
import { cn } from '../../shared/ui/utils'
import { authConfig } from './auth.config'
import { GoogleButton } from './google-button'

const siteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''

export default function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const unlinkUncertain = (location.state as { googleUnlinkUncertain?: unknown } | null)?.googleUnlinkUncertain === true
  const [pending, setPending] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<unknown>()
  const [token, setToken] = useState('')
  const [attempt, setAttempt] = useState(0)
  const submitting = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const errorRef = useRef<HTMLDivElement>(null)
  const configMissing = import.meta.env.PROD && !siteKey

  async function signInWithGoogle(idToken: string) {
    if (submitting.current || configMissing) return
    if (siteKey && !token) {
      setError(new Error('Vui lòng đợi xác minh bảo mật hoàn tất trước khi đăng nhập bằng Google.'))
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }
    submitting.current = true
    setPending(true)
    setError(undefined)
    try {
      await authCommand('/auth/google', { idToken, ...(token ? { turnstileToken: token } : {}) })
      clearIdentity()
      announceSessionChange()
      if (mounted.current) navigate('/staff', { replace: true })
    } catch (failure) {
      if (mounted.current) {
        setError(failure)
        requestAnimationFrame(() => errorRef.current?.focus())
      }
    } finally {
      submitting.current = false
      if (mounted.current) { setPending(false); setToken(''); setAttempt((value) => value + 1) }
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-base font-bold text-primary">
            <Coffee className="h-6 w-6" />
            Coffee Shop
          </Link>
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer',
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Thực đơn
          </Link>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-140px)] items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-border bg-card rounded-2xl">
          <CardHeader className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">NHÂN VIÊN</p>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Đăng nhập
            </CardTitle>
            <CardDescription>
              Đăng nhập hệ thống nội bộ Coffee Homes
            </CardDescription>
          </CardHeader>

          <CardContent>
            {unlinkUncertain && <p role="alert" className="mb-4 text-sm text-destructive">
              Chưa xác nhận được hủy liên kết Google. Đăng nhập lại để kiểm tra tài khoản.
            </p>}
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault()
                if (submitting.current || configMissing)
                  return
                if (siteKey && !token) {
                  setError(new Error('Vui lòng đợi xác minh bảo mật hoàn tất trước khi đăng nhập.'))
                  requestAnimationFrame(() => errorRef.current?.focus())
                  return
                }
                const form = event.currentTarget
                const values = new FormData(form)
                submitting.current = true
                setPending(true)
                setError(undefined)
                try {
                  await authCommand('/auth/sign-in', {
                    email: String(values.get('email')).trim(),
                    password: String(values.get('password')),
                    ...(token ? { turnstileToken: token } : {}),
                  })
                  form.reset()
                  clearIdentity()
                  announceSessionChange()
                  if (mounted.current) navigate('/staff', { replace: true })
                } catch (failure) {
                  if (!mounted.current) return
                  setError(failure)
                  const password = form.elements.namedItem(
                    'password',
                  ) as HTMLInputElement
                  if (password) password.value = ''
                  requestAnimationFrame(() => errorRef.current?.focus())
                } finally {
                  submitting.current = false
                  if (mounted.current) {
                    setPending(false)
                    setToken('')
                    setAttempt((value) => value + 1)
                  }
                }
              }}
            >
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={254}
                  required
                  disabled={pending}
                  placeholder="nhanvien@coffeeshop.vn"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-foreground">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={visible ? 'text' : 'password'}
                    autoComplete="current-password"
                    maxLength={256}
                    required
                    disabled={pending}
                    className="pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setVisible((value) => !value)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {siteKey && (
                <Turnstile key={attempt} siteKey={siteKey} onToken={setToken} />
              )}

              {configMissing && (
                <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Đăng nhập chưa sẵn sàng. Vui lòng liên hệ quản lý.
                </p>
              )}

              {error !== undefined && (
                <div
                  ref={errorRef}
                  tabIndex={-1}
                  className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  <p>{errorMessage(error)}</p>
                  {error instanceof ApiError && error.requestId && (
                    <small className="block mt-1 text-xs opacity-80">Mã hỗ trợ: {error.requestId}</small>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full flex items-center justify-center gap-2 font-bold shadow-sm cursor-pointer"
                isLoading={pending}
                disabled={pending || configMissing || Boolean(siteKey && !token)}
              >
                <LogIn className="h-4 w-4" />
                {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </Button>

              <Link to="/forgot-password" className="block text-center text-sm font-semibold text-primary">Quên mật khẩu?</Link>
              {authConfig.googleClientId && !pending && !configMissing && (!siteKey || token) && (
                <GoogleButton clientId={authConfig.googleClientId} onCredential={(credential) => void signInWithGoogle(credential)} />
              )}
              {authConfig.signupEnabled && <div className="pt-2 text-center text-xs text-muted-foreground">
                Chưa có tài khoản nhân sự?{' '}
                <Link to="/sign-up" className="font-semibold text-primary hover:underline">
                  Đăng ký tài khoản mới
                </Link>
              </div>}
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
