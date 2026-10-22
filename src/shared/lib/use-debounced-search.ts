import { useEffect, useState } from 'react'

export function useDebouncedSearch(value: string) {
  const normalized = value.trim()
  const [search, setSearch] = useState(normalized)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(normalized), 300)
    return () => window.clearTimeout(timer)
  }, [normalized])

  return search
}
