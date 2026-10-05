import type { z } from 'zod'
import type { selectedOptionsSchema } from '../api/order-options'

export function OrderOptions({
  options,
}: {
  options: z.infer<typeof selectedOptionsSchema>
}) {
  if (!options.length) return null
  return (
    <ul className="space-y-1 text-xs text-foreground">
      {options.map((option) => (
        <li key={option.id} className="break-words">
          <strong>{option.groupName}:</strong> {option.name}
        </li>
      ))}
    </ul>
  )
}
