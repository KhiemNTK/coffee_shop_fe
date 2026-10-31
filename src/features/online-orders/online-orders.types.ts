import type { CartItem } from './cart'
import type { OrderAccess } from './order-access-storage'

export type CartCheckoutProps = {
  cart: CartItem[]
  onClose: () => void
  onUpdateQuantity: (id: string, delta: number) => void
  onRemoveItem: (id: string) => void
  onAppendItems: (items: CartItem[]) => void
  onOrderCreated: (order: OrderAccess) => void
}
