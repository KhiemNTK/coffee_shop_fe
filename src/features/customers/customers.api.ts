import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiMutate, ApiError } from '../../shared/api/client'
import { itemSchema } from '../menu/menu.api'
import { announceCustomerSessionChange } from '../../app/query-client'

const customerSchema = z.object({ id: z.uuid(), email: z.email() })
const wishlistSchema = z.object({
  customerId: z.uuid(),
  items: z
    .array(
      z.object({
        menuItemId: z.uuid(),
        item: itemSchema.extend({ isAvailable: z.boolean() }).nullable(),
      }),
    )
    .max(100),
})
export const customerKey = ['customer', 'me'] as const
export const wishlistKey = (id: string) => ['customer', id, 'wishlist'] as const

export function useCustomer() {
  return useQuery({
    queryKey: customerKey,
    queryFn: async ({ signal }) => {
      try {
        return await apiGet('/customers/me', customerSchema, signal)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    retry: false,
    staleTime: 10000,
    gcTime: 60000,
    refetchOnWindowFocus: 'always',
  })
}

export function useWishlist() {
  const customer = useCustomer()
  const client = useQueryClient()
  const id = customer.data?.id ?? ''
  const wishlist = useQuery({
    queryKey: wishlistKey(id),
    enabled: Boolean(id),
    retry: false,
    staleTime: 10000,
    gcTime: 60000,
    queryFn: async ({ signal }) => {
      try {
        const response = await apiGet('/customers/wishlist', wishlistSchema, signal)
        if (response.customerId !== id) throw new ApiError(401, 'CUSTOMER_SESSION_CHANGED')
        return response
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          void client.invalidateQueries({ queryKey: customerKey })
        throw error
      }
    },
  })
  return { customer, wishlist }
}

export function customerSignIn(idToken: string, turnstileToken: string) {
  return apiMutate(
    '/customers/auth/google',
    'POST',
    z.object({ customer: customerSchema }),
    { idToken, ...(turnstileToken ? { turnstileToken } : {}) },
    undefined,
    false,
  )
}

export function customerLogout() {
  return apiMutate(
    '/customers/auth/logout',
    'POST',
    z.object({ success: z.literal(true) }),
    undefined,
    undefined,
    false,
  )
}

export function useCustomerLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: customerLogout,
    retry: false,
    onMutate: () => client.cancelQueries({ queryKey: ['customer'] }),
    onSuccess: () => {
      client.removeQueries({
        queryKey: ['customer'],
        predicate: (query) => query.queryKey[1] !== 'me',
      })
      client.setQueryData(customerKey, null)
      announceCustomerSessionChange()
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: customerKey })
    },
  })
}

export type FavoriteIntent = {
  menuItemId: string
  expectedCustomerId: string
  remove: boolean
}
export function saveFavorite(intent: FavoriteIntent) {
  return apiMutate(
    `/customers/wishlist/${intent.menuItemId}`,
    intent.remove ? 'DELETE' : 'PUT',
    z.object({ success: z.literal(true) }),
    { expectedCustomerId: intent.expectedCustomerId },
    undefined,
    false,
  )
}
