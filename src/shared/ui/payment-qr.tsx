import { useEffect, useRef, useState } from 'react'

export function PaymentQr({ value }: { value: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failedValue, setFailedValue] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void import('qrcode').then(async ({ default: qr }) => {
      if (cancelled || !canvas.current) return
      await qr.toCanvas(canvas.current, value, {
        width: 220, margin: 4, errorCorrectionLevel: 'M',
      })
    }).catch(() => { if (!cancelled) setFailedValue(value) })
    return () => { cancelled = true }
  }, [value])
  return failedValue === value
    ? <p role="alert" className="text-sm text-destructive">Không tạo được mã QR. Vui lòng mở liên kết thanh toán.</p>
    : <canvas ref={canvas} width={220} height={220} role="img" aria-label="Mã QR thanh toán" className="mx-auto h-[220px] w-[220px] max-w-full" />
}
