import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, X } from 'lucide-react'
import { Button } from '../../../shared/ui'

// shortcut: native camera decoding only; add a decoder if the deployed POS browser needs it.
type QrDetectorConstructor = {
  new (options: { formats: string[] }): {
    detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
  }
  getSupportedFormats(): Promise<string[]>
}

export function PickupCodeScanner({
  onScan,
  disabled,
}: {
  onScan: (token: string) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!scanning || disabled) return
    let cancelled = false
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = Date.now() + 30_000
    const hide = () => {
      if (document.hidden) setScanning(false)
    }
    document.addEventListener('visibilitychange', hide)
    async function start() {
      const Detector = (window as unknown as { BarcodeDetector?: QrDetectorConstructor })
        .BarcodeDetector
      try {
        if (
          !window.isSecureContext ||
          !Detector ||
          !navigator.mediaDevices?.getUserMedia ||
          !(await Detector.getSupportedFormats()).includes('qr_code')
        ) {
          if (!cancelled) {
            setError(t('takeaway.scanUnsupported'))
            setScanning(false)
          }
          return
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const preview = video.current
        if (!preview) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        preview.srcObject = stream
        await preview.play()
        const detector = new Detector({ formats: ['qr_code'] })
        async function scan() {
          if (cancelled) return
          if (Date.now() >= deadline) {
            setError(t('takeaway.scanTimeout'))
            setScanning(false)
            return
          }
          try {
            if (preview!.readyState >= 2) {
              const codes = await detector.detect(preview!)
              if (cancelled) return
              const token = codes
                .map((code) => code.rawValue.trim().toLowerCase())
                .find((value) => /^[0-9a-f]{64}$/.test(value))
              if (token) {
                onScan(token)
                setScanning(false)
                return
              }
              if (codes.length) setError(t('takeaway.invalidAccess'))
            }
          } catch {
            if (!cancelled) {
              setError(t('takeaway.scanFailed'))
              setScanning(false)
            }
            return
          }
          if (!cancelled) timer = setTimeout(() => void scan(), 250)
        }
        await scan()
      } catch {
        if (!cancelled) {
          setError(t('takeaway.scanFailed'))
          setScanning(false)
        }
      }
    }
    void start()
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', hide)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [scanning, disabled, onScan, t])
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-pressed={scanning && !disabled}
        onClick={() => {
          setError(null)
          setScanning((value) => !value)
        }}
      >
        {scanning ? <X size={16} aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
        {t(scanning ? 'common.cancel' : 'takeaway.scanPickupQr')}
      </Button>
      {scanning && !disabled && (
        <video
          ref={video}
          muted
          playsInline
          aria-label={t('takeaway.scanPickupQr')}
          className="aspect-[4/3] w-full rounded-md bg-black object-cover"
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
