import {
  Coffee,
  Leaf,
  Cake,
  CupSoda,
  UtensilsCrossed,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface CategoryVisual {
  icon: LucideIcon
  colorClass: string
  bgClass: string
}

export function getCategoryVisual(categoryName: string): CategoryVisual {
  const normalized = categoryName.toLowerCase()

  if (/cà phê|coffee|espresso|cappuccino/.test(normalized)) {
    return {
      icon: Coffee,
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500/10 group-hover:bg-amber-500/20 border-amber-500/20',
    }
  }

  if (/trà|tea/.test(normalized)) {
    return {
      icon: Leaf,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10 group-hover:bg-emerald-500/20 border-emerald-500/20',
    }
  }

  if (/bánh|pastry|cake|bakery|pantry/.test(normalized)) {
    return {
      icon: Cake,
      colorClass: 'text-rose-500 dark:text-rose-400',
      bgClass: 'bg-rose-500/10 group-hover:bg-rose-500/20 border-rose-500/20',
    }
  }

  if (/lạnh|đá|cold|iced|latte|smoothie/.test(normalized)) {
    return {
      icon: CupSoda,
      colorClass: 'text-sky-500 dark:text-sky-400',
      bgClass: 'bg-sky-500/10 group-hover:bg-sky-500/20 border-sky-500/20',
    }
  }

  if (/combo|set/.test(normalized)) {
    return {
      icon: UtensilsCrossed,
      colorClass: 'text-orange-500 dark:text-orange-400',
      bgClass: 'bg-orange-500/10 group-hover:bg-orange-500/20 border-orange-500/20',
    }
  }

  if (/muối|salt|đặc biệt|signature|special/.test(normalized)) {
    return {
      icon: Sparkles,
      colorClass: 'text-violet-500 dark:text-violet-400',
      bgClass: 'bg-violet-500/10 group-hover:bg-violet-500/20 border-violet-500/20',
    }
  }

  return {
    icon: Coffee,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10 group-hover:bg-primary/20 border-primary/20',
  }
}

