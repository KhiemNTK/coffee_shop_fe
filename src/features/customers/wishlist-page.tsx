import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, LogOut, Plus, RefreshCw } from 'lucide-react'
import { authConfig } from '../auth/auth.config'
import { GoogleButton } from '../auth/google-button'
import { Turnstile } from '../auth/turnstile'
import { SiteHeader } from '@/shared/components/site-header'
import { ProductDetailModal } from '../menu/components/product-detail-modal'
import { formatPrice, type MenuItem } from '../menu/menu.api'
import { useCart } from '../online-orders/cart'
import { Button } from '../../shared/ui'
import { errorMessage } from '../../shared/api/client'
import { customerKey, customerLogout, customerSignIn, useWishlist } from './customers.api'
import { FavoriteButton } from './favorite-button'

export default function WishlistPage() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const { customer, wishlist } = useWishlist()
  const [token, setToken] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<MenuItem | null>(null)
  const [loginPending, setLoginPending] = useState(false)
  const [loginError, setLoginError] = useState<unknown>()
  const flight = useRef(false)
  const cart = useCart()
  async function signIn(credential: string) {
    if (flight.current) return
    flight.current = true
    setLoginPending(true)
    setLoginError(undefined)
    try {
      await client.cancelQueries({ queryKey: ['customer'] })
      const { customer: account } = await customerSignIn(credential, token)
      client.removeQueries({ queryKey: ['customer'] })
      client.setQueryData(customerKey, account)
    } catch (error) {
      setLoginError(error)
    } finally {
      flight.current = false
      setLoginPending(false)
      setToken('')
      setAttempt((value) => value + 1)
    }
  }
  const logout = useMutation({
    mutationFn: customerLogout,
    retry: false,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: ['customer'] })
    },
    onSuccess: () => {
      client.removeQueries({ queryKey: ['customer'] })
      client.setQueryData(customerKey, null)
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: customerKey })
    },
  })
  const failed = customer.error ?? wishlist.error ?? loginError ?? logout.error
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Heart aria-hidden="true" />
            {t('wishlist.title')}
          </h1>
          {customer.data && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="break-all text-sm text-muted-foreground">
                {customer.data.email}
              </span>
              <Button
                variant="outline"
                disabled={logout.isPending || loginPending}
                onClick={() => logout.mutate()}
              >
                <LogOut size={16} aria-hidden="true" />
                {t('auth.signOut')}
              </Button>
            </div>
          )}
        </div>
        {failed && (
          <p role="alert" className="mb-4 break-words text-destructive">
            {errorMessage(failed)}
          </p>
        )}
        {customer.isPending ? (
          <p role="status">{t('common.loading')}</p>
        ) : customer.isError ? (
          <Button variant="outline" onClick={() => void customer.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            {t('common.reload')}
          </Button>
        ) : !customer.data ? (
          <section className="max-w-sm space-y-4">
            <h2 className="text-lg font-semibold">{t('wishlist.customerSignIn')}</h2>
            {authConfig.googleClientId ? (
              <>
                {authConfig.turnstileSiteKey && (
                  <Turnstile
                    key={attempt}
                    siteKey={authConfig.turnstileSiteKey}
                    action="login"
                    onToken={setToken}
                  />
                )}
                {!loginPending && (!authConfig.turnstileSiteKey || token) && (
                  <GoogleButton
                    clientId={authConfig.googleClientId}
                    onCredential={(credential) => {
                      void signIn(credential)
                    }}
                  />
                )}
                {loginPending && <p role="status">{t('common.loading')}</p>}
              </>
            ) : (
              <p role="status">{t('wishlist.googleUnavailable')}</p>
            )}
          </section>
        ) : wishlist.isPending ? (
          <p role="status">{t('common.loading')}</p>
        ) : wishlist.isError ? (
          <Button variant="outline" onClick={() => void wishlist.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            {t('common.reload')}
          </Button>
        ) : (
          <>
            {!wishlist.data?.items.length && (
              <div className="space-y-3">
                <p>{t('wishlist.empty')}</p>
                <Link to="/menu" className="text-primary underline">
                  {t('nav.menu')}
                </Link>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {wishlist.data?.items.map(({ menuItemId, item }) => (
                <article
                  key={menuItemId}
                  className="flex items-start gap-4 rounded-lg border border-border p-4"
                >
                  {item?.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-20 w-20 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <h2 className="break-words text-base font-semibold">
                      {item?.name ?? t('wishlist.archived')}
                    </h2>
                    {item && <p>{formatPrice(item.price)}</p>}
                    {item?.isAvailable ? (
                      <Button
                        size="sm"
                        className="h-auto min-h-11 max-w-full whitespace-normal px-2"
                        onClick={() => setSelected(item)}
                      >
                        <Plus size={16} aria-hidden="true" />
                        {t('menu.chooseItem')}
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('wishlist.unavailable')}
                      </p>
                    )}
                  </div>
                  <FavoriteButton itemId={menuItemId} />
                </article>
              ))}
            </div>
          </>
        )}
        {selected && (
          <ProductDetailModal
            item={selected}
            onClose={() => setSelected(null)}
            onConfirm={(item) => {
              cart.addItem(item)
              setSelected(null)
            }}
          />
        )}
      </main>
    </div>
  )
}
