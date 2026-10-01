import { useEffect, useRef, useState } from 'react'

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      action: string
      size: 'flexible'
      theme: 'light'
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptFlight: Promise<TurnstileApi> | undefined
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptFlight) {
    scriptFlight = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script')
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      const fail = () => {
        script.remove()
        reject(new Error('Verification unavailable'))
      }
      const timer = window.setTimeout(fail, 15_000)
      script.onerror = () => {
        clearTimeout(timer)
        fail()
      }
      script.onload = () => {
        clearTimeout(timer)
        if (window.turnstile) resolve(window.turnstile)
        else fail()
      }
      document.head.append(script)
    }).catch((error) => {
      scriptFlight = undefined
      throw error
    })
  }
  return scriptFlight
}

export function Turnstile({
  siteKey,
  onToken,
  action = 'login',
}: {
  siteKey: string
  onToken: (token: string) => void
  action?: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    let widget: string | undefined
    let api: TurnstileApi | undefined
    onToken('')
    void loadTurnstile()
      .then((loaded) => {
        if (cancelled || !container.current) return
        api = loaded
        widget = api.render(container.current, {
          sitekey: siteKey,
          action,
          size: 'flexible',
          theme: 'light',
          callback: (token) => {
            if (!cancelled) {
              onToken(token)
              setFailed(false)
            }
          },
          'expired-callback': () => {
            if (!cancelled) onToken('')
          },
          'error-callback': () => {
            if (!cancelled) {
              onToken('')
              setFailed(true)
            }
          },
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (widget !== undefined) api?.remove(widget)
    }
  }, [siteKey, onToken, attempt, action])
  return (
    <div className="verification">
      <div ref={container} />
      {failed && (
        <div role="alert">
          Chưa xác minh được bảo mật.
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            Thử lại xác minh
          </button>
        </div>
      )}
    </div>
  )
}
