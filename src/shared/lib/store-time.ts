// This single-store calendar uses Vietnam time, not the operator's device timezone.
export const storeTimeZone = 'Asia/Ho_Chi_Minh'
const offsetMs = 7 * 60 * 60 * 1000

export function toStoreLocal(date: Date) {
  return new Date(date.getTime() + offsetMs).toISOString().slice(0, 16)
}

export function fromStoreLocal(value: string) {
  const date = new Date(`${value}:00+07:00`)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    toStoreLocal(date) !== value
  )
    throw new Error('Invalid store time')
  return date
}

export const formatStoreDateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { timeZone: storeTimeZone, hour12: false })
