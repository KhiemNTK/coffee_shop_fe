import type { MenuItem } from '../menu/menu.api'

export type DraftItem = {
  id: string
  menuItem: MenuItem
  quantity: number
  note: string
  selectedOptionIds: string[]
  calculatedPrice: number
}
