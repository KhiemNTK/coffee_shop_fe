import type { MenuItem } from '../menu/menu.api'

export interface CartItem {
  id: string
  menuItem: MenuItem
  quantity: number
  note: string
  selectedOptionIds: string[]
  calculatedUnitPrice: string
}

export function minorAmount(value: string) {
  const [integer = '0', fraction = ''] = value.split('.')
  return BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export function decimalAmount(minor: bigint) {
  return `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`
}

export function cartSubtotal(cart: CartItem[]) {
  return decimalAmount(cart.reduce((sum, item) =>
    sum + minorAmount(item.calculatedUnitPrice) * BigInt(item.quantity), 0n))
}
