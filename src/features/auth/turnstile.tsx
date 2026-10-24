import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react'
import { useTheme } from '../../shared/theme'

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      action: string
      size?: 'compact' | 'normal' | 'flexible'
      theme?: 'light' | 'dark' | 'auto'
      language?: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
      'timeout-callback': () => void
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
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
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
  size,
}: {
  siteKey: string
  onToken: (token: string) => void
  action?: string
  size?: 'compact' | 'normal' | 'flexible'
}) {
  const { t: translate, i18n } = useTranslation()
  const { resolvedTheme } = useTheme()
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [responsiveSize, setResponsiveSize] = useState<'compact' | 'flexible'>('compact')
  const widgetSize = size ?? responsiveSize

  useEffect(() => {
    const element = container.current
    if (!element || size) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setResponsiveSize(entry.contentRect.width < 300 ? 'compact' : 'flexible')
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [size])

  useEffect(() => {
    let cancelled = false
    let widget: string | undefined
    let api: TurnstileApi | undefined
    const fail = () => {
      if (!cancelled) {
        onToken('')
        setFailed(true)
      }
    }
    onToken('')
    void loadTurnstile()
      .then((loaded) => {
        if (cancelled || !container.current) return
        api = loaded
        widget = api.render(container.current, {
          sitekey: siteKey,
          action,
          size: widgetSize,
          theme: resolvedTheme,
          language: i18n.resolvedLanguage,
          callback: (token) => {
            if (!cancelled) {
              onToken(token)
              setFailed(false)
            }
          },
          'expired-callback': () => {
            if (!cancelled) onToken('')
          },
          'error-callback': fail,
          'timeout-callback': fail,
        })
      })
      .catch(fail)
    return () => {
      cancelled = true
      if (widget !== undefined) api?.remove(widget)
    }
  }, [siteKey, onToken, attempt, action, widgetSize, i18n.resolvedLanguage, resolvedTheme])

  return (
    <div className="verification space-y-2">
      <div className="flex items-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          {translate('auth.verification')}
        </span>
      </div>

      <div
        ref={container}
        className={`flex items-center justify-center rounded-lg border border-border/50 bg-muted/20 p-1 ${widgetSize === 'compact' ? 'min-h-[150px]' : 'min-h-[75px]'}`}
      />

      {failed && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive"
        >
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{translate('auth.verificationFailed')}</span>
          </div>
          <button
            type="button"
            className="flex min-h-11 items-center gap-1 px-2 font-semibold text-destructive underline hover:opacity-80 cursor-pointer text-button shrink-0"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {translate('auth.retryVerification')}
          </button>
        </div>
      )}
    </div>
  )
}
