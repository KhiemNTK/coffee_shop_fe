import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { apiMutate, errorMessage } from '../../shared/api/client'
import { clearIdentity, announceSessionChange } from '../../app/query-client'
import { Button, Input } from '../../shared/ui'
import { sessionKey } from './session'
import { authConfig } from './auth.config'
import { GoogleButton } from './google-button'

export function GoogleAccount({ linked }: { linked: boolean }) {
  const [credential, setCredential] = useState('')
  const client = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: (password: string) => apiMutate<unknown>(
      linked ? '/auth/google/unlink' : '/auth/google/link', 'POST',
      linked ? z.object({ unlinked: z.literal(true) }) : z.object({ linked: z.literal(true) }),
      { password, ...(linked ? {} : { idToken: credential }) },
    ),
    onSuccess: () => {
      setCredential('')
      if (linked) {
        clearIdentity(); announceSessionChange(); navigate('/sign-in', { replace: true })
      } else void client.invalidateQueries({ queryKey: sessionKey })
    },
  })
  if (!authConfig.googleClientId && !linked) return null
  return <section className="space-y-3 border-t border-border pt-4">
    <h2 className="text-lg font-semibold">Đăng nhập Google</h2>
    <p className="text-sm">{linked ? 'Đã liên kết tài khoản Google.' : 'Chưa liên kết tài khoản Google.'}</p>
    {!linked && <GoogleButton clientId={authConfig.googleClientId} onCredential={setCredential} />}
    <form className="max-w-md space-y-3" onSubmit={(event) => {
      event.preventDefault()
      if (mutation.isPending || (!linked && !credential)) return
      const password = String(new FormData(event.currentTarget).get('password'))
      event.currentTarget.reset()
      mutation.mutate(password)
    }}>
      <label className="block text-sm">Mật khẩu hiện tại<Input name="password" type="password" autoComplete="current-password" required disabled={mutation.isPending} /></label>
      {mutation.error && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
      <Button type="submit" variant="outline" isLoading={mutation.isPending} disabled={!linked && !credential}>
        {linked ? 'Hủy liên kết và đăng xuất' : 'Liên kết Google'}
      </Button>
    </form>
  </section>
}
