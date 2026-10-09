import {
  storeTimeZone as timeZone,
  toStoreLocal as toReservationLocal,
} from '../../shared/lib/store-time.js'
export {
  toStoreLocal as toReservationLocal,
  fromStoreLocal as fromReservationLocal,
  formatStoreDateTime as formatReservationDateTime,
} from '../../shared/lib/store-time.js'

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
