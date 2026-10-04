import { useEffect, useRef, useState } from 'react'

type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (result: { credential: string }) => void; auto_select: boolean }) => void
  renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string; locale: string; width: number }) => void
}
declare global { interface Window { google?: { accounts: { id: GoogleIdentity } } } }
let scriptFlight: Promise<GoogleIdentity> | undefined

function loadGoogle() {
  if (window.google) return Promise.resolve(window.google.accounts.id)
  scriptFlight ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    const fail = () => { script.remove(); reject(new Error('Google unavailable')) }
    const timer = window.setTimeout(fail, 15_000)
    script.onerror = () => { clearTimeout(timer); fail() }
    script.onload = () => {
      clearTimeout(timer)
      if (window.google) resolve(window.google.accounts.id)
      else fail()
    }
    document.head.append(script)
  }).catch((error) => { scriptFlight = undefined; throw error })
  return scriptFlight
}

export function GoogleButton({ clientId, onCredential }: {
  clientId: string; onCredential: (credential: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  const [failed, setFailed] = useState(false)
  useEffect(() => { callback.current = onCredential }, [onCredential])
  useEffect(() => {
    let cancelled = false
    const element = container.current
    void loadGoogle().then((api) => {
      if (cancelled || !element) return
      api.initialize({
        client_id: clientId, auto_select: false,
        callback: (result) => { if (!cancelled) callback.current(result.credential) },
      })
      api.renderButton(element, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'vi', width: 280 })
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; element?.replaceChildren() }
  }, [clientId])
  return failed
    ? <p role="alert" className="text-sm text-destructive">Google chưa sẵn sàng. Vui lòng đăng nhập bằng mật khẩu.</p>
    : <div ref={container} className="flex min-h-11 justify-center" />
}
