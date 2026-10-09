import type { MenuItem } from '../menu/menu.api'
import { decimalAmount, minorAmount } from '../../shared/lib/money'

export { decimalAmount, minorAmount } from '../../shared/lib/money'

export interface CartItem {
  id: string
  menuItem: MenuItem
  quantity: number
  note: string
  selectedOptionIds: string[]
  calculatedUnitPrice: string
}

export function cartSubtotal(cart: CartItem[]) {
  return decimalAmount(cart.reduce((sum, item) =>
    sum + minorAmount(item.calculatedUnitPrice) * BigInt(item.quantity), 0n))
}
