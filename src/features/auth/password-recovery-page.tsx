import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { apiMutate } from '../../shared/api/client'
import { useRetryAfter } from '../../shared/api/use-retry-after'
import { clearIdentity, announceSessionChange } from '../../app/query-client'
import { ApiErrorAlert, Button, Input } from '../../shared/ui'
import { authConfig } from './auth.config'
import { Turnstile } from './turnstile'

export default function PasswordRecoveryPage() {
  const { t: translate } = useTranslation()
  const location = useLocation()
  const resetting = location.pathname.includes('reset-password')
  const [resetToken] = useState(() => new URLSearchParams(location.search).get('token') ?? '')
  const [captcha, setCaptcha] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const retryWait = useRetryAfter(error)
  const submitting = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const unavailable = !resetting && import.meta.env.PROD && !authConfig.turnstileSiteKey

  useEffect(() => {
    if (resetting && location.search)
      window.history.replaceState(window.history.state, '', location.pathname)
  }, [resetting, location.pathname, location.search])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || unavailable || retryWait > 0) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const password = String(fields.get('password') ?? '')
    if (
      resetting &&
      (password.length < 12 ||
        new TextEncoder().encode(password).length > 72 ||
        password !== fields.get('confirmation'))
    ) {
      setError(translate('auth.passwordRules'))
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }
    submitting.current = true
    setPending(true)
    setError(null)
    try {
      await apiMutate(
        resetting ? '/auth/reset-password' : '/auth/forgot-password',
        'POST',
        z.object({ message: z.string() }),
        resetting
          ? { token: resetToken, password }
          : {
              email: String(fields.get('email')).trim(),
              ...(captcha ? { turnstileToken: captcha } : {}),
            },
        undefined,
        false,
      )
      if (resetting) {
        clearIdentity()
        announceSessionChange()
      }
      form.reset()
      setDone(true)
    } catch (failure) {
      setError(failure)
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
      <Link to="/" className="font-semibold text-primary">
        Coffee Shop
      </Link>
      <h1 className="text-2xl font-bold">
        {resetting ? translate('auth.resetPassword') : translate('auth.forgotPassword')}
      </h1>
      {done ? (
        <p role="status">
          {resetting ? translate('auth.passwordChanged') : translate('auth.resetSent')}
        </p>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {resetting ? (
            <>
              <label className="block space-y-1">
                <span>{translate('auth.newPassword')}</span>
                <Input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={72}
                  required
                  disabled={pending}
                />
              </label>
              <label className="block space-y-1">
                <span>{translate('auth.confirmPassword')}</span>
                <Input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={72}
                  required
                  disabled={pending}
                />
              </label>
              {!resetToken && <p role="alert">{translate('auth.invalidResetLink')}</p>}
            </>
          ) : (
            <>
              <label className="block space-y-1">
                <span>{translate('auth.staffEmail')}</span>
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  disabled={pending}
                />
              </label>
              {authConfig.turnstileSiteKey && (
                <Turnstile
                  key={attempt}
                  siteKey={authConfig.turnstileSiteKey}
                  action="password_reset"
                  onToken={setCaptcha}
                />
              )}
            </>
          )}
          {unavailable && <p role="alert">{translate('auth.recoveryUnavailable')}</p>}
          {error != null && (
            <div ref={errorRef} tabIndex={-1}>
              <ApiErrorAlert error={error} />
            </div>
          )}
          <Button
            type="submit"
            isLoading={pending}
            disabled={
              unavailable ||
              retryWait > 0 ||
              (resetting ? !resetToken : Boolean(authConfig.turnstileSiteKey && !captcha))
            }
          >
            {resetting ? translate('auth.changePassword') : translate('auth.sendInstructions')}
          </Button>
        </form>
      )}
      <Link to="/sign-in" className="block text-sm font-semibold text-primary">
        {translate('auth.backToSignIn')}
      </Link>
    </main>
  )
}
