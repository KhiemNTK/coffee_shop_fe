import { z } from 'zod'

const nonnegativeDecimal = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/)

export const moneySchema = z.union([
  nonnegativeDecimal,
  z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER / 100)
    .transform(String).pipe(nonnegativeDecimal),
])

export const signedMoneySchema = z.union([
  z.string().regex(/^-?\d{1,16}(\.\d{1,2})?$/),
  z
    .number()
    .finite()
    .min(-Number.MAX_SAFE_INTEGER / 100)
    .max(Number.MAX_SAFE_INTEGER / 100)
    .transform(String)
    .pipe(z.string().regex(/^-?\d{1,16}(\.\d{1,2})?$/)),
])
