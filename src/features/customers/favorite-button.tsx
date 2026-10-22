import { useId, useRef } from 'react'
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
  const errorId = useId()
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
  const mutationError =
    mutation.variables?.expectedCustomerId === customer.data?.id ? mutation.error : null
  const retry =
    Boolean(mutationError) &&
    (!(mutationError instanceof ApiError) ||
      mutationError.status >= 500 ||
      [408, 429].includes(mutationError.status))
  const failed = mutationError ?? customer.error ?? wishlist.error
  const label = failed
    ? `${errorMessage(failed)}${retry || customer.isError ? `. ${t('common.retry')}` : ''}`
    : t(saved ? 'wishlist.remove' : 'wishlist.add')
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={saved}
        aria-describedby={mutationError ? errorId : undefined}
        disabled={
          customer.isPending ||
          mutation.isPending ||
          Boolean(customer.data && (wishlist.isPending || wishlist.isError || wishlist.isFetching))
        }
        className={cn(
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-card text-primary dark:text-foreground shadow-xs disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
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
                returnTo: location.pathname + location.search + location.hash,
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
      {mutationError && (
        <p
          id={errorId}
          role="alert"
          className="w-full min-w-0 shrink-0 break-words rounded-md border border-destructive/40 bg-card p-3 text-sm text-foreground"
        >
          {errorMessage(mutationError)}
        </p>
      )}
    </>
  )
}
