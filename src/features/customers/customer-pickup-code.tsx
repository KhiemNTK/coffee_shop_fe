import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Eye, EyeOff } from 'lucide-react'
import { Button } from '../../shared/ui'
import { formatStoreDateTime } from '../../shared/lib/store-time'

export function CustomerPickupCode({ token, expiresAt }: { token: string; expiresAt: string }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [copyState, setCopyState] = useState<'copied' | 'failed' | null>(null)
  const [expired, setExpired] = useState(() => Date.parse(expiresAt) <= Date.now())
  useEffect(() => {
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(expiresAt) - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [expiresAt])
  async function copy() {
    if (Date.parse(expiresAt) <= Date.now()) return
    try {
      await navigator.clipboard.writeText(token)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }
  if (expired) return null
  return (
    <section
      aria-label={t('customer.pickupCode')}
      className="space-y-3 border-y border-border py-4"
    >
      <h3 className="text-base font-semibold">{t('customer.pickupCode')}</h3>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" aria-pressed={visible} onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {t(visible ? 'customer.hidePickupCode' : 'customer.showPickupCode')}
        </Button>
        <Button variant="outline" onClick={() => void copy()}>
          <Copy size={16} aria-hidden="true" />
          {t('takeaway.copyAccess')}
        </Button>
      </div>
      {visible && <code className="block select-all break-all text-sm">{token}</code>}
      <p className="text-sm text-muted-foreground">{t('customer.pickupCodePrivacy')}</p>
      <p className="text-xs text-muted-foreground">
        {t('customer.pickupCodeExpiry', { time: formatStoreDateTime(expiresAt) })}
      </p>
      {copyState && (
        <p role={copyState === 'failed' ? 'alert' : 'status'} className="text-sm">
          {t(copyState === 'failed' ? 'takeaway.copyFailed' : 'takeaway.copied')}
        </p>
      )}
    </section>
  )
}
