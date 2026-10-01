import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, ApiError, sessionEvents } from '../../shared/api/client'

const employeeSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  fullName: z.string(),
  username: z.string(),
  isActive: z.boolean(),
  position: z.object({ id: z.uuid(), name: z.string() }).nullable(),
})
const permissionsSchema = z.object({
  employeeId: z.uuid(),
  permissionKeys: z.array(z.string()),
  roleNames: z.array(z.string()),
})

export const sessionKey = ['private', 'session'] as const
export type Session = {
  employee: z.infer<typeof employeeSchema>
  authorization: z.infer<typeof permissionsSchema>
}

export function useSession(enabled = true) {
  return useQuery({
    queryKey: sessionKey,
    enabled,
    queryFn: async ({ signal }) => {
      const [employee, authorization] = await Promise.all([
        apiGet('/auth/me', employeeSchema, signal, true),
        apiGet('/auth/me/permissions', permissionsSchema, signal, true),
      ])
      if (!employee.isActive || employee.id !== authorization.employeeId) {
        sessionEvents.dispatchEvent(new Event('expired'))
        throw new ApiError(401)
      }
      return { employee, authorization }
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: 'always',
  })
}
