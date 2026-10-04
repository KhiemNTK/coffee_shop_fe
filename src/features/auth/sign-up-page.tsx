import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Coffee,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react'
import { authCommand, ApiError, errorMessage } from '../../shared/api/client'
import { announceSessionChange, clearIdentity } from '../../app/query-client'
import { Turnstile } from './turnstile'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { buttonVariants } from '../../shared/ui/button-variants'
import { Input } from '../../shared/ui/input'
import { cn } from '../../shared/ui/utils'

const siteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''

function calculatePasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  if (!password) return { score: 0, label: '', color: 'bg-muted' }
  let score = 0
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^a-zA-Z0-9]/.test(password)) score += 1

  if (score <= 1) return { score: 1, label: 'Yếu (Tối thiểu 12 ký tự)', color: 'bg-destructive' }
  if (score === 2) return { score: 2, label: 'Trung bình', color: 'bg-amber-500' }
  if (score === 3) return { score: 3, label: 'Khá mạnh', color: 'bg-emerald-500' }
  return { score: 4, label: 'Rất an toàn', color: 'bg-emerald-600' }
}

export default function SignUpPage() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<unknown>()
  const [token, setToken] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [passwordValue, setPasswordValue] = useState('')

  const submitting = useRef(false)
  const mounted = useRef(true)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const configMissing = import.meta.env.PROD && !siteKey
  const strength = calculatePasswordStrength(passwordValue)

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-base font-bold text-primary">
            <Coffee className="h-6 w-6" />
            Coffee Shop
          </Link>
          <Link
            to="/sign-in"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer',
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Đăng nhập
          </Link>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-140px)] items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-xl border-border bg-card rounded-2xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                TÀI KHOẢN NỘI BỘ
              </p>
              <span className="text-xs text-muted-foreground">
                Đăng ký nhân sự mới
              </span>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Đăng ký tài khoản
            </CardTitle>
            <CardDescription>
              Tạo tài khoản nhân viên để truy cập hệ thống bán hàng POS & Quản trị Coffee Shop
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault()
                if (submitting.current || configMissing || (siteKey && !token))
                  return

                const form = event.currentTarget
                const values = new FormData(form)
                const password = String(values.get('password'))

                if (password.length < 12) {
                  setError(new Error('Mật khẩu phải có tối thiểu 12 ký tự để đảm bảo an toàn.'))
                  return
                }

                submitting.current = true
                setPending(true)
                setError(undefined)

                try {
                  const phoneRaw = String(values.get('phoneNumber') || '').trim()
                  const addressRaw = String(values.get('address') || '').trim()

                  await authCommand('/auth/sign-up', {
                    fullName: String(values.get('fullName')).trim(),
                    username: String(values.get('username')).trim().toLowerCase(),
                    email: String(values.get('email')).trim().toLowerCase(),
                    password,
                    phoneNumber: phoneRaw || undefined,
                    address: addressRaw || undefined,
                  })

                  form.reset()
                  clearIdentity()
                  announceSessionChange()
                  if (mounted.current) navigate('/staff', { replace: true })
                } catch (failure) {
                  clearIdentity()
                  if (!mounted.current) return
                  setError(failure)
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
              {/* Họ tên & Username */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="block text-sm font-semibold text-foreground">
                    Họ và tên <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    maxLength={100}
                    disabled={pending}
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="username" className="block text-sm font-semibold text-foreground">
                    Tên đăng nhập <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={50}
                    disabled={pending}
                    placeholder="nhanvien_01"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-foreground">
                  Email nhân viên <span className="text-destructive">*</span>
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  disabled={pending}
                  placeholder="nhanvien@coffeeshop.vn"
                />
              </div>

              {/* Mật khẩu */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-foreground">
                  Mật khẩu <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    required
                    disabled={pending}
                    className="pr-10"
                    placeholder="Tối thiểu 12 ký tự"
                    value={passwordValue}
                    onChange={(e) => setPasswordValue(e.target.value)}
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

                {passwordValue && (
                  <div className="pt-1 space-y-1">
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full transition-all duration-300',
                          strength.color,
                          strength.score === 1 && 'w-1/4',
                          strength.score === 2 && 'w-2/4',
                          strength.score === 3 && 'w-3/4',
                          strength.score === 4 && 'w-full',
                        )}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Độ an toàn: <strong className="text-foreground">{strength.label}</strong></span>
                      {passwordValue.length >= 12 && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> Đạt yêu cầu 12 ký tự
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Số điện thoại & Địa chỉ (tùy chọn) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="phoneNumber" className="block text-sm font-semibold text-foreground">
                    Số điện thoại <span className="text-xs text-muted-foreground">(tùy chọn)</span>
                  </label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    minLength={10}
                    maxLength={15}
                    disabled={pending}
                    placeholder="0912345678"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="address" className="block text-sm font-semibold text-foreground">
                    Địa chỉ <span className="text-xs text-muted-foreground">(tùy chọn)</span>
                  </label>
                  <Input
                    id="address"
                    name="address"
                    type="text"
                    maxLength={500}
                    disabled={pending}
                    placeholder="Quận 1, TP. HCM"
                  />
                </div>
              </div>

              {siteKey && (
                <Turnstile key={attempt} siteKey={siteKey} onToken={setToken} />
              )}

              {configMissing && (
                <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Đăng ký chưa sẵn sàng. Vui lòng liên hệ quản lý.
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
                <UserPlus className="h-4 w-4" />
                {pending ? 'Đang tạo tài khoản…' : 'Đăng ký tài khoản'}
              </Button>

              <div className="pt-2 text-center text-xs text-muted-foreground">
                Đã có tài khoản nhân viên?{' '}
                <Link to="/sign-in" className="font-semibold text-primary hover:underline">
                  Đăng nhập tại đây
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
