import type { MenuItem } from './menu.api'

// Declarative semantic image fallback rules (ordered by specificity)
export const SEMANTIC_IMAGE_RULES: Array<{ match: RegExp; image: string }> = [
  { match: /matcha/i, image: '/matcha-latte.jpg' },
  { match: /muối|salt|đặc biệt|signature/i, image: '/coffee-salt.jpg' },
  { match: /croissant/i, image: '/croissant.jpg' },
  { match: /bánh|pastry|cake|bakery|cookie|cheesecake|bread/i, image: '/chocolate-cake.jpg' },
  { match: /trà|tea/i, image: '/fruit-tea.jpg' },
  { match: /combo|set/i, image: '/combo-set.jpg' },
  { match: /lạnh|đá|cold|iced|latte/i, image: '/iced-latte.jpg' },
  { match: /americano/i, image: '/americano.jpg' },
  { match: /cà phê|coffee|espresso|cappuccino/i, image: '/cappuccino.jpg' },
]

export function getProductImage(item: MenuItem): string {
  // 1. Authoritative Backend URL (Source of Truth)
  if (item.imageUrl) {
    return item.imageUrl
  }

  // 2. Category Semantic Match (Primary)
  const categoryName = item.category?.name || ''
  for (const rule of SEMANTIC_IMAGE_RULES) {
    if (rule.match.test(categoryName)) {
      return rule.image
    }
  }

  // 3. Item Name Semantic Match (Secondary, handles generic or UUID categories)
  const itemName = item.name || ''
  for (const rule of SEMANTIC_IMAGE_RULES) {
    if (rule.match.test(itemName)) {
      return rule.image
    }
  }

  // 4. Neutral Brand Default
  return '/iced-coffee.jpg'
}
