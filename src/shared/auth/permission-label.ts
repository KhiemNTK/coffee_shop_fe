import { PermissionLabels } from './permission-contract'

export function getPermissionLabel(key: string, language: 'vi' | 'en', fallback = key) {
  const labels: Readonly<Record<string, readonly [string, string] | undefined>> = PermissionLabels
  return labels[key]?.[language === 'en' ? 1 : 0] ?? fallback
}
