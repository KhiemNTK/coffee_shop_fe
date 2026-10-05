// This single-store booking calendar uses Vietnam time, not the POS device timezone.
const timeZone = 'Asia/Ho_Chi_Minh'
const vietnamOffsetMs = 7 * 60 * 60 * 1000

export function toReservationLocal(date: Date) {
  return new Date(date.getTime() + vietnamOffsetMs).toISOString().slice(0, 16)
}

export function fromReservationLocal(value: string) {
  const date = new Date(`${value}:00+07:00`)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    toReservationLocal(date) !== value
  ) {
    throw new Error('Invalid reservation time')
  }
  return date
}

export function reservationDayBounds(offset: number, now = new Date()) {
  const midnight = new Date(`${toReservationLocal(now).slice(0, 10)}T00:00:00+07:00`)
  const start = midnight.getTime() + offset * 86_400_000
  return {
    startsFrom: new Date(start).toISOString(),
    startsTo: new Date(start + 86_400_000 - 1).toISOString(),
  }
}

export const formatReservationDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { timeZone })
export const formatReservationTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
export const formatReservationDateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { timeZone, hour12: false })
