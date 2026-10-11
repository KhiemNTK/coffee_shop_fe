import type { z } from 'zod'
import type { selectedOptionsSchema } from '../api/order-options'

export function OrderOptions({
  options,
}: {
  options: z.infer<typeof selectedOptionsSchema>
}) {
  if (!options.length) return null
  return (
    <ul className="space-y-0.5 text-xs text-foreground/90 mt-1">
      {options.map((option) => (
        <li key={option.id} className="break-words leading-snug">
          <span className="text-muted-foreground font-medium">{option.groupName}:</span>{' '}
          <span className="font-semibold text-foreground break-words">{option.name}</span>
        </li>
      ))}
    </ul>
  )
}
