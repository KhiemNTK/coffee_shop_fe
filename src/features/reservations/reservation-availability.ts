export type ReservationWindow = { startsAt: string; endsAt: string }
export const tableAvailabilityKey = (
  window: ReservationWindow | null,
  tableId: string,
  exclude?: number,
) =>
  window && tableId
    ? JSON.stringify([window.startsAt, window.endsAt, tableId, exclude ?? null])
    : null
