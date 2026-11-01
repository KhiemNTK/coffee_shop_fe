export const normalizePhone = (value: string) => value.trim().replace(/[()\-\s]/g, '')
export const isValidPhone = (value: string) =>
  /^[0-9+()\-\s]{1,30}$/.test(value.trim()) && /^\+?[0-9]{8,15}$/.test(normalizePhone(value))
