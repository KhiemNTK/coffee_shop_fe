import { z } from 'zod'
import { ApiError, apiGet, apiMutate } from '../../shared/api/client'
import { menuImageUrlSchema } from './menu.api'

const imagePolicySchema = z.object({
  enabled: z.boolean(),
  maxBytes: z
    .number()
    .int()
    .positive()
    .max(2 * 1024 * 1024),
  mimeTypes: z.array(z.enum(['image/jpeg', 'image/png', 'image/webp'])).min(1),
})
const uploadedImageSchema = z.object({
  id: z.uuid(),
  url: menuImageUrlSchema,
  expiresAt: z.iso.datetime(),
})

export function getMenuImagePolicy(signal?: AbortSignal) {
  return apiGet('/menu/images/policy', imagePolicySchema, signal, true)
}

export async function uploadMenuImage(file: File, purpose: 'create' | 'update') {
  const body = new FormData()
  body.append('file', file)
  try {
    return await apiMutate(
      `/menu/images/${purpose}`,
      'POST',
      uploadedImageSchema,
      body,
      undefined,
      true,
      30_000,
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 413)
      throw new ApiError(413, 'IMAGE_UPLOAD_TOO_LARGE', error.requestId)
    throw error
  }
}
