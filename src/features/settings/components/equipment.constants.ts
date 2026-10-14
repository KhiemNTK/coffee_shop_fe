import type { EquipmentStatus } from '@/features/settings/settings.api'

export const ALLOWED_EQUIPMENT_TRANSITIONS: Record<
  EquipmentStatus,
  EquipmentStatus[]
> = {
  IN_USE: ['MAINTENANCE', 'BROKEN', 'LIQUIDATED'],
  MAINTENANCE: ['IN_USE', 'BROKEN', 'LIQUIDATED'],
  BROKEN: ['MAINTENANCE', 'LIQUIDATED'],
  LIQUIDATED: [],
}
