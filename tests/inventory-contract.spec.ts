import { expect, test } from '@playwright/test'
import { quantitySchema } from '../src/features/inventory/quantity.ts'

test('inventory quantities accept the actual numeric API contract without money rounding', () => {
  expect(quantitySchema.parse(1.0001)).toBe('1.0001')
  expect(quantitySchema.parse('0.2344')).toBe('0.2344')
  expect(quantitySchema.parse('-0.1234')).toBe('-0.1234')
  expect(quantitySchema.parse('99999999999999.9999')).toBe('99999999999999.9999')
  for (const value of [0.12345, Infinity, NaN, Number.MAX_SAFE_INTEGER, '1e3'])
    expect(quantitySchema.safeParse(value).success).toBe(false)
})
