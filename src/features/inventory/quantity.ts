import { z } from 'zod'

export const quantitySchema = z.union([
  z.string(),
  z.number().finite().min(-Number.MAX_SAFE_INTEGER / 10000).max(Number.MAX_SAFE_INTEGER / 10000).transform(String),
]).pipe(z.string().regex(/^-?\d{1,14}(\.\d{1,4})?$/))

const integerFormatter = new Intl.NumberFormat('vi-VN')

export function quantityDifference(counted: string, expected: string): string {
  const scaled = (value: string) => {
    const negative = value.startsWith('-')
    const [integer = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.')
    return (BigInt(integer) * 10000n + BigInt(fraction.padEnd(4, '0'))) * (negative ? -1n : 1n)
  }
  const difference = scaled(counted) - scaled(expected)
  const magnitude = difference < 0n ? -difference : difference
  return `${difference < 0n ? '-' : ''}${magnitude / 10000n}.${String(magnitude % 10000n).padStart(4, '0')}`
}

export function formatQuantity(value: string): string {
  const negative = value.startsWith('-')
  const [integer = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.')
  const decimals = fraction.replace(/0+$/, '')
  return `${negative ? '-' : ''}${integerFormatter.format(BigInt(integer))}${decimals ? ',' + decimals : ''}`
}
