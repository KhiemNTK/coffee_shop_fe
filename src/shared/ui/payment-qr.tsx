import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function PaymentQr({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failedValue, setFailedValue] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void import('qrcode').then(async ({ default: qr }) => {
      if (cancelled || !canvas.current) return
      await qr.toCanvas(canvas.current, value, {
        width: 220, margin: 4, errorCorrectionLevel: 'M',
        color: { dark: '#000000ff', light: '#ffffffff' },
      })
    }).catch(() => { if (!cancelled) setFailedValue(value) })
    return () => { cancelled = true }
  }, [value])
  return failedValue === value
    ? <p role="alert" className="text-sm text-destructive">{t('payment.qrUnavailable')}</p>
    : <canvas ref={canvas} width={220} height={220} role="img" aria-label={label ?? t('payment.qrLinkLabel')} className="mx-auto h-auto w-55 max-w-full rounded-md bg-white" />
}
