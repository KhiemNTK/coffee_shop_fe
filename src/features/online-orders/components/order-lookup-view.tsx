import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { trackOnlineOrder } from '../online-orders.api'
import type { OrderAccess } from '../order-access-storage'
import { errorMessage } from '../../../shared/api/client'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '../../../shared/ui'

interface OrderLookupViewProps {
  onFound: (order: OrderAccess) => void
  onBack: () => void
}

export function OrderLookupView({ onFound, onBack }: OrderLookupViewProps) {
  const { t: translate } = useTranslation()
  const [requestId, setRequestId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const cleanId = requestId.trim().toLowerCase()
    const cleanToken = accessToken.trim().toLowerCase()

    if (!cleanId || !cleanToken) {
      setError(translate('takeaway.lookupMissing'))
      return
    }

    setLoading(true)
    try {
      const order = await trackOnlineOrder(cleanId, cleanToken)
      onFound({
        requestId: cleanId,
        accessToken: cleanToken,
        accessExpiresAt: order.accessExpiresAt,
      })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-4 text-muted-foreground gap-1.5 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {translate('common.back')}
      </Button>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-foreground">
            {translate('takeaway.lookupHeading')}
          </CardTitle>
          <CardDescription>{translate('takeaway.lookupDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label htmlFor="lookup-order-id" className="block text-xs font-semibold text-foreground mb-1.5">
                {translate('takeaway.orderId')}
              </label>
              <Input
                id="lookup-order-id"
                type="text"
                required
                placeholder="VD: a1b2c3d4-..."
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="lookup-access-code" className="block text-xs font-semibold text-foreground mb-1.5">
                {translate('takeaway.accessCode')}
              </label>
              <Input
                id="lookup-access-code"
                type="password"
                autoComplete="off"
                required
                placeholder={translate('takeaway.accessExample')}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full font-bold"
              disabled={loading}
              isLoading={loading}
            >
              {translate('takeaway.lookupNow')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
