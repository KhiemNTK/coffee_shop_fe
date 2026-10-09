import { decimalAmount, minorAmount } from './money'

const integerFormatter = new Intl.NumberFormat('vi-VN')

/**
 * Format currency in VND with exact decimal support (comma separator) and BigInt safety
 */
export function formatVnd(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0 ₫'
  const str = typeof value === 'string' ? value.trim() : String(value)
  if (!str) return '0 ₫'

  const negative = str.startsWith('-')
  const [integer = '0', fraction = ''] = (negative ? str.slice(1) : str).split('.')
  try {
    const formattedInt = integerFormatter.format(BigInt(integer || '0'))
    const decimals = /[1-9]/.test(fraction) ? `,${fraction.padEnd(2, '0')}` : ''
    return `${negative ? '-' : ''}${formattedInt}${decimals} ₫`
  } catch {
    const num = Number(str)
    return Number.isNaN(num) ? '0 ₫' : `${integerFormatter.format(num)} ₫`
  }
}

/**
 * Alias for formatVnd for backwards-compatibility
 */
export const formatPrice = formatVnd

// Display snapshot line amounts exactly; invoice totals remain server-authoritative.
export function formatLineAmount(unitPrice: string, quantity: number): string {
  return formatVnd(decimalAmount(minorAmount(unitPrice) * BigInt(quantity)))
}

/**
 * Format date in vi-VN locale (DD/MM/YYYY)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return typeof date === 'string' ? date : '—'
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Format date and time in vi-VN locale (DD/MM/YYYY HH:mm)
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return typeof date === 'string' ? date : '—'
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format active session duration in human-readable Vietnamese (e.g. "45 phút", "1h 15p")
 */
export function formatSessionDuration(createdAt?: string): string {
  if (!createdAt) return ''
  const createdMs = Date.parse(createdAt)
  if (Number.isNaN(createdMs)) return ''
  const diffMinutes = Math.max(0, Math.floor((Date.now() - createdMs) / 60000))
  if (diffMinutes < 60) return `${diffMinutes} phút`
  const hours = Math.floor(diffMinutes / 60)
  const mins = diffMinutes % 60
  return `${hours}h ${mins}p`
}
