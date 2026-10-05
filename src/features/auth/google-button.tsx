import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '../../shared/ui/button'

type GoogleIdentity = {
  initialize: (options: {
    client_id: string
    callback: (result: { credential: string }) => void
    auto_select: boolean
  }) => void
  renderButton: (
    element: HTMLElement,
    options: {
      theme: string
      size: string
      text: string
      locale: string
      width: number
    },
  ) => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } }
  }
}
let scriptFlight: Promise<GoogleIdentity> | undefined

function loadGoogle() {
  if (window.google?.accounts?.id)
    return Promise.resolve(window.google.accounts.id)
  scriptFlight ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    const fail = () => {
      script.remove()
      reject(new Error('Google unavailable'))
    }
    const timer = window.setTimeout(fail, 15_000)
    script.onerror = () => {
      clearTimeout(timer)
      fail()
    }
    script.onload = () => {
      clearTimeout(timer)
      if (window.google?.accounts?.id) resolve(window.google.accounts.id)
      else fail()
    }
    document.head.append(script)
  }).catch((error) => {
    scriptFlight = undefined
    throw error
  })
  return scriptFlight
}

export function GoogleButton({
  clientId,
  onCredential,
}: {
  clientId: string
  onCredential: (credential: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    callback.current = onCredential
  }, [onCredential])
  useEffect(() => {
    let cancelled = false
    const element = container.current
    void loadGoogle()
      .then((api) => {
        if (cancelled || !element) return
        api.initialize({
          client_id: clientId,
          auto_select: false,
          callback: (result) => {
            if (!cancelled && result.credential)
              callback.current(result.credential)
          },
        })
        api.renderButton(element, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          locale: 'vi',
          width: Math.min(240, element.clientWidth),
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      element?.replaceChildren()
    }
  }, [clientId, attempt])
  return (
    <div className="min-h-11 space-y-2">
      <div ref={container} className="flex min-h-11 justify-center" />
      {failed && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            Chưa kết nối được Google.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Thử lại Google
          </Button>
        </div>
      )}
    </div>
  )
}
