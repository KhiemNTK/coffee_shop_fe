import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Heart, LoaderCircle } from 'lucide-react'
import { ApiError, errorMessage } from '../../shared/api/client'
import { cn } from '../../shared/ui'
import { customerKey, saveFavorite, useWishlist, wishlistKey } from './customers.api'

export function FavoriteButton({ itemId, className }: { itemId: string; className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const client = useQueryClient()
  const { customer, wishlist } = useWishlist()
  const flight = useRef(false)
  const saved = Boolean(wishlist.data?.items.some((item) => item.menuItemId === itemId))
  const mutation = useMutation({
    mutationFn: saveFavorite,
    retry: false,
    onSuccess: (_, intent) => {
      void client.invalidateQueries({
        queryKey: wishlistKey(intent.expectedCustomerId),
      })
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.code === 'CUSTOMER_SESSION_CHANGED')
      )
        void client.invalidateQueries({ queryKey: customerKey })
    },
    onSettled: () => {
      flight.current = false
    },
  })
  const retry =
    mutation.isError &&
    (!(mutation.error instanceof ApiError) ||
      mutation.error.status >= 500 ||
      [408, 429].includes(mutation.error.status))
  const failed = mutation.error ?? customer.error ?? wishlist.error
  const label = failed
    ? `${errorMessage(failed)}. ${t('common.retry')}`
    : t(saved ? 'wishlist.remove' : 'wishlist.add')
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={saved}
      disabled={
        customer.isPending ||
        mutation.isPending ||
        Boolean(customer.data && (wishlist.isPending || wishlist.isError || wishlist.isFetching))
      }
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/95 text-primary shadow-xs disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation()
        if (flight.current) return
        if (!customer.data) {
          if (customer.isError) {
            void customer.refetch()
            return
          }
          navigate('/customer/sign-in', {
            state: {
              returnTo: location.pathname + location.search,
              favoriteItemId: itemId,
            },
          })
          return
        }
        if (retry && mutation.variables?.expectedCustomerId !== customer.data.id) return
        flight.current = true
        mutation.mutate(
          retry && mutation.variables
            ? mutation.variables
            : {
                menuItemId: itemId,
                expectedCustomerId: customer.data.id,
                remove: saved,
              },
        )
      }}
    >
      {mutation.isPending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : failed ? (
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Heart className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden="true" />
      )}
    </button>
  )
}
