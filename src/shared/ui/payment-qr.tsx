import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function PaymentQr({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failedValue, setFailedValue] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void import('qrcode')
      .then(async ({ default: qr }) => {
        const target = canvas.current
        if (cancelled || !target) return
        await qr.toCanvas(target, value, {
          width: 220,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000ff', light: '#ffffffff' },
        })
        // qrcode sets an inline pixel height; let a narrow container preserve the square ratio.
        target.style.height = 'auto'
      })
      .catch(() => {
        if (!cancelled) setFailedValue(value)
      })
    return () => {
      cancelled = true
    }
  }, [value])
  return failedValue === value ? (
    <p role="alert" className="text-sm text-destructive">
      {t('payment.qrUnavailable')}
    </p>
  ) : (
    <canvas
      ref={canvas}
      width={220}
      height={220}
      role="img"
      aria-label={label ?? t('payment.qrLinkLabel')}
      className="mx-auto h-auto w-55 max-w-full rounded-md bg-white"
    />
  )
}
