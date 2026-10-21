import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { authConfig } from '../auth/auth.config'
import { GoogleButton } from '../auth/google-button'
import { Turnstile } from '../auth/turnstile'
import { SiteHeader } from '../../shared/components/site-header'
import { Button } from '../../shared/ui'
import { ApiError, errorMessage } from '../../shared/api/client'
import { customerKey, customerSignIn, saveFavorite, useCustomer } from './customers.api'

const intentSchema = z.object({
  returnTo: z.string().regex(/^\/(?:[?#].*|(?:menu|wishlist|cart|account|order)(?:[/?#].*)?)?$/),
  favoriteItemId: z.uuid().optional(),
})

export function CustomerSignIn({ returnTo = '/account' }: { returnTo?: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const customer = useCustomer()
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
  const errorRef = useRef<HTMLParagraphElement>(null)
  const configMissing = import.meta.env.PROD && !authConfig.turnstileSiteKey
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function finish(credential?: string) {
    if (
      flight.current ||
      (credential && (configMissing || (authConfig.turnstileSiteKey && !token)))
    )
      return
    flight.current = true
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

  return (
    <section
      className="mx-auto w-full max-w-md space-y-5 py-6"
      aria-label={t('wishlist.customerSignIn')}
    >
      <ShieldCheck className="h-8 w-8 text-primary" aria-hidden="true" />
      <h2 className="text-xl font-semibold">{t('wishlist.customerSignIn')}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t('customer.signInDescription')}
      </p>
      {(error || customer.error) && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="break-words text-sm text-destructive"
        >
          {errorMessage(error ?? customer.error)}
        </p>
      )}
      {customer.isPending ? (
        <p role="status">{t('common.loading')}</p>
      ) : customer.isError ? (
        <Button variant="outline" onClick={() => void customer.refetch()}>
          {t('common.retry')}
        </Button>
      ) : customer.data ? (
        <div className="space-y-3">
          <p className="break-all text-sm">{customer.data.email}</p>
          <Button isLoading={pending} disabled={pending} onClick={() => void finish()}>
            <ArrowRight size={16} aria-hidden="true" />
            {t(itemId ? 'wishlist.add' : 'customer.continue')}
          </Button>
        </div>
      ) : !authConfig.googleClientId || configMissing ? (
        <p role="status" className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
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
          ) : !authConfig.turnstileSiteKey || token ? (
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
      <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-border pt-4 text-sm">
        <Link to="/menu" className="font-medium text-primary underline">
          {t('customer.continueGuest')}
        </Link>
        <Link to="/sign-in" className="text-muted-foreground underline">
          {t('customer.staffPortal')}
        </Link>
      </div>
    </section>
  )
}

export default function CustomerSignInPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="sr-only">{t('wishlist.customerSignIn')}</h1>
        <CustomerSignIn />
      </main>
    </div>
  )
}
