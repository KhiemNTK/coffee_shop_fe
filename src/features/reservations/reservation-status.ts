import { i18n, type TranslationKey } from '@/shared/i18n'
import type { ReservationStatus, ReservationRequestStatus } from './reservations.api'

const labels: Record<ReservationStatus | ReservationRequestStatus, TranslationKey> = {
  PENDING: 'reservation.awaitingGuest',
  ARRIVED: 'reservation.arrived',
  CANCELLED: 'reservation.cancelledShort',
  NO_SHOW: 'reservation.noShowShort',
  APPROVED: 'reservation.approved',
  REJECTED: 'reservation.rejectedShort',
  EXPIRED: 'reservation.expiredShort',
}
export const reservationStatusLabel = (
  status: ReservationStatus | ReservationRequestStatus,
  request = false,
) => i18n.t(request && status === 'PENDING' ? 'reservation.awaitingReview' : labels[status])
