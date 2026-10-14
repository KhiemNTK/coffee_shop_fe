import { useState, useEffect } from 'react'
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
  return decimalAmount(
    cart.reduce(
      (sum, item) =>
        sum + minorAmount(item.calculatedUnitPrice) * BigInt(item.quantity),
      0n,
    ),
  )
}

const CART_STORAGE_KEY = 'coffee_shop_storefront_cart'

let inMemoryCart: CartItem[] = []
try {
  const saved = sessionStorage.getItem(CART_STORAGE_KEY)
  if (saved) {
    inMemoryCart = JSON.parse(saved)
  }
} catch {
  inMemoryCart = []
}

const listeners = new Set<() => void>()

function broadcastCartChange() {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(inMemoryCart))
  } catch {}
  listeners.forEach((listener) => listener())
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => inMemoryCart)

  useEffect(() => {
    const handler = () => setItems([...inMemoryCart])
    listeners.add(handler)
    return () => {
      listeners.delete(handler)
    }
  }, [])

  function addItem(newItem: CartItem) {
    const matchIndex = inMemoryCart.findIndex(
      (it) =>
        it.menuItem.id === newItem.menuItem.id &&
        it.note === newItem.note &&
        it.selectedOptionIds.slice().sort().join(',') ===
          newItem.selectedOptionIds.slice().sort().join(','),
    )
    if (matchIndex >= 0) {
      const existing = inMemoryCart[matchIndex]
      if (existing) {
        inMemoryCart[matchIndex] = {
          ...existing,
          quantity: Math.min(20, existing.quantity + newItem.quantity),
        }
      }
    } else {
      inMemoryCart = [...inMemoryCart, newItem]
    }
    broadcastCartChange()
  }

  function updateQuantity(id: string, delta: number) {
    inMemoryCart = inMemoryCart
      .map((it) => {
        if (it.id !== id) return it
        const newQty = it.quantity + delta
        return newQty > 0 ? { ...it, quantity: Math.min(20, newQty) } : null
      })
      .filter((it): it is CartItem => it !== null)
    broadcastCartChange()
  }

  function removeItem(id: string) {
    inMemoryCart = inMemoryCart.filter((it) => it.id !== id)
    broadcastCartChange()
  }

  function clearCart() {
    inMemoryCart = []
    broadcastCartChange()
  }

  const subtotal = cartSubtotal(items)
  const totalCount = items.reduce((sum, it) => sum + it.quantity, 0)

  return {
    items,
    totalCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  }
}
