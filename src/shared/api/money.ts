import { z } from 'zod'

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
