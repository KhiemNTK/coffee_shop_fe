import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowRight, Heart, LogOut, UserRound } from 'lucide-react'
import { authConfig } from '../auth/auth.config'
import { GoogleButton } from '../auth/google-button'
import { Turnstile } from '../auth/turnstile'
import { SiteHeader } from '@/features/storefront/site-header'
import { SignInScene } from '../auth/sign-in-scene'
import { buttonVariants } from '../../shared/ui/button-variants'
import { ApiErrorAlert, Button } from '../../shared/ui'
import { ApiError } from '../../shared/api/client'
import { useRetryAfter } from '../../shared/api/use-retry-after'
import { announceCustomerSessionChange } from '@/shared/api/query-client'
import {
  customerKey,
  customerSignIn,
  saveFavorite,
  useCustomer,
  useCustomerLogout,
} from './customers.api'

const intentSchema = z.object({
  returnTo: z
    .string()
    .regex(
      /^\/(?:[?#].*|(?:menu|wishlist|cart|account|order|reservations|pickup|reorder|about|contact)(?:[/?#].*)?)?$/
    ),
  favoriteItemId: z.uuid().optional(),
})

export function CustomerSignIn({ returnTo = '/account' }: { returnTo?: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const customer = useCustomer()
  const logout = useCustomerLogout()
  const navigate = useNavigate()
  const location = useLocation()
  const intent = intentSchema.safeParse(location.state)
  const destination = intent.success ? intent.data.returnTo : returnTo
  const itemId = intent.success ? intent.data.favoriteItemId : undefined
  const [token, setToken] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>()
  const flight = useRef(false)
  const mounted = useRef(true)
  const errorRef = useRef<HTMLDivElement>(null)
  const configMissing = import.meta.env.PROD && !authConfig.turnstileSiteKey
  const failure = error ?? logout.error ?? customer.error
  const retryWait = useRetryAfter(failure)
  const logoutRetryWait = useRetryAfter(logout.error)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function finish(credential?: string) {
    if (
      flight.current ||
      retryWait > 0 ||
      logout.isPending ||
      (credential && (configMissing || (authConfig.turnstileSiteKey && !token)))
    )
      return
    flight.current = true
    logout.reset()
    setPending(true)
    setError(undefined)
    try {
      let account = customer.data
      if (credential) {
        await client.cancelQueries({ queryKey: ['customer'] })
        account = (await customerSignIn(credential, token)).customer
        client.removeQueries({
          queryKey: ['customer'],
          predicate: (query) => query.queryKey[1] !== 'me',
        })
        client.setQueryData(customerKey, account)
        announceCustomerSessionChange()
      }
      if (!account || !mounted.current) return
      if (itemId) {
        await saveFavorite({
          menuItemId: itemId,
          expectedCustomerId: account.id,
          remove: false,
        })
        await client.invalidateQueries({
          queryKey: ['customer', account.id, 'wishlist'],
        })
      }
      if (mounted.current) navigate(destination, { replace: true, state: null })
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        (failure.status === 401 || failure.code === 'CUSTOMER_SESSION_CHANGED')
      )
        void client.invalidateQueries({ queryKey: customerKey })
      if (mounted.current) {
        setError(failure)
        requestAnimationFrame(() => errorRef.current?.focus())
      }
    } finally {
      flight.current = false
      if (mounted.current) {
        setPending(false)
        setToken('')
        setAttempt((value) => value + 1)
      }
    }
  }

  function switchAccount() {
    if (flight.current || logout.isPending || logoutRetryWait > 0) return
    flight.current = true
    setError(undefined)
    logout.mutate(undefined, {
      onSuccess: () => {
        setToken('')
        setAttempt((value) => value + 1)
      },
      onError: () => requestAnimationFrame(() => errorRef.current?.focus()),
      onSettled: () => {
        flight.current = false
      },
    })
  }

  return (
    <section
      className="customer-sign-in mx-auto w-full max-w-md space-y-5 py-6"
      aria-label={t('wishlist.customerSignIn')}
    >
      <div className="flex items-center gap-3">
        <span className="sign-in-form__icon">
          <Heart size={21} aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold text-muted-foreground">{t('auth.customerHeading')}</p>
      </div>
      <h2 className="text-2xl font-bold">{t('wishlist.customerSignIn')}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t('customer.signInDescription')}
      </p>
      {failure && (
        <div
          ref={errorRef}
          tabIndex={-1}
        >
          <ApiErrorAlert error={failure} />
        </div>
      )}
      {customer.isPending ? (
        <p role="status">{t('common.loading')}</p>
      ) : customer.isError ? (
        <Button variant="outline" disabled={retryWait > 0 || customer.isFetching} onClick={() => void customer.refetch()}>
          {t('common.retry')}
        </Button>
      ) : customer.data ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-y border-border py-4">
            <UserRound size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="min-w-0 break-all text-sm font-medium">{customer.data.email}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              isLoading={pending}
              disabled={pending || logout.isPending || retryWait > 0}
              onClick={() => void finish()}
            >
              <ArrowRight size={16} aria-hidden="true" />
              {t(itemId ? 'wishlist.add' : 'customer.continue')}
            </Button>
            <Button
              variant="outline"
              isLoading={logout.isPending}
              disabled={pending || logout.isPending || logoutRetryWait > 0}
              onClick={switchAccount}
            >
              <LogOut size={16} aria-hidden="true" />
              {t('customer.switchAccount')}
            </Button>
          </div>
        </div>
      ) : !authConfig.googleClientId || configMissing ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface-muted p-4 text-sm leading-relaxed text-muted-foreground"
        >
          {t('customer.loginUnavailable')}
        </p>
      ) : (
        <div className="space-y-4">
          {authConfig.turnstileSiteKey && (
            <Turnstile
              key={attempt}
              siteKey={authConfig.turnstileSiteKey}
              action="login"
              onToken={setToken}
            />
          )}
          {pending ? (
            <p role="status">{t('auth.signingIn')}</p>
          ) : retryWait > 0 ? null : !authConfig.turnstileSiteKey || token ? (
            <GoogleButton
              clientId={authConfig.googleClientId}
              onCredential={(credential) => {
                void finish(credential)
              }}
            />
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              {t('auth.waitVerification')}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-col items-center gap-3 border-t border-border pt-5 text-sm">
        <Link
          to="/menu"
          className={buttonVariants({ variant: 'outline', className: 'min-h-11 w-full gap-2' })}
        >
          {t('customer.continueGuest')}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link
          to="/sign-in"
          className="inline-flex min-h-11 items-center text-sm text-foreground underline-offset-4 hover:underline"
        >
          {t('customer.staffPortal')}
        </Link>
      </div>
    </section>
  )
}

export default function CustomerSignInPage() {
  const { t } = useTranslation()
  return (
    <SignInScene header={<SiteHeader />}>
      <h1 className="sr-only">{t('wishlist.customerSignIn')}</h1>
      <CustomerSignIn />
    </SignInScene>
  )
}
