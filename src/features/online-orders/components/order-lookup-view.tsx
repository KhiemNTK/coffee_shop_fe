import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { trackOnlineOrder } from '../online-orders.api'
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
  onFound: (order: { requestId: string; accessToken: string }) => void
  onBack: () => void
}

export function OrderLookupView({ onFound, onBack }: OrderLookupViewProps) {
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
      setError('Vui lòng nhập đầy đủ Mã đơn hàng và Mã xác thực.')
      return
    }

    setLoading(true)
    try {
      await trackOnlineOrder(cleanId, cleanToken)
      onFound({ requestId: cleanId, accessToken: cleanToken })
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
        className="mb-4 text-stone-600 gap-1.5 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Button>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-brand-900">Tra cứu đơn mang đi</CardTitle>
          <CardDescription>
            Nhập mã đơn hàng và mã bảo mật mà quán đã cung cấp khi đặt hàng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Mã đơn hàng
              </label>
              <Input
                type="text"
                required
                placeholder="VD: a1b2c3d4-..."
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Mã xác thực
              </label>
              <Input
                type="text"
                required
                placeholder="Mã 64 ký tự hex"
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
              Tra cứu ngay
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
