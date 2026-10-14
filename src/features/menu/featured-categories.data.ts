// Dynamic semantic image resolver for backend categories
export function getCategoryThumbnail(categoryName: string): string {
  const normalized = categoryName.toLowerCase()
  if (/cà phê|coffee|espresso|cappuccino/.test(normalized)) return '/cappuccino.jpg'
  if (/trà|tea/.test(normalized)) return '/fruit-tea.jpg'
  if (/bánh|pastry|cake|bakery|pantry/.test(normalized)) return '/chocolate-cake.jpg'
  if (/matcha/.test(normalized)) return '/matcha-latte.jpg'
  if (/lạnh|đá|cold|iced|latte/.test(normalized)) return '/iced-latte.jpg'
  if (/combo|set/.test(normalized)) return '/combo-set.jpg'
  if (/muối|salt|đặc biệt|signature/.test(normalized)) return '/coffee-salt.jpg'
  return '/hero-coffee.jpg'
}
