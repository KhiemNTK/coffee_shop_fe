import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { z } from 'zod'
import { CheckCircle2, Clock, Coffee, RefreshCw, XCircle } from 'lucide-react'
import { apiGet, errorMessage } from '../../shared/api/client'
import { Button, buttonVariants, Card, CardContent, Badge, cn } from '../../shared/ui'

const resultSchema = z.object({
  signatureValid: z.boolean(),
  attempt: z.object({
    id: z.string(),
    invoiceId: z.string(),
    status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REQUIRES_REVIEW']),
  }).nullable(),
})

export default function PaymentReturnPage() {
  const { provider } = useParams<{ provider: string }>()
  const { search } = useLocation()
  const [startedAt] = useState(Date.now)
  const supported = provider === 'vnpay' || provider === 'momo'
  const result = useQuery({
    queryKey: ['payment-return', provider, search],
    queryFn: ({ signal }) => apiGet(`/payments/${provider}/return${search}`, resultSchema, signal),
    enabled: supported,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) =>
      query.state.data?.attempt?.status === 'PENDING' && Date.now() - startedAt < 30_000
        ? 3000
        : false,
  })
  const status = result.data?.attempt?.status
  const message = !supported
    ? 'Cổng thanh toán không hợp lệ.'
    : result.isPending
      ? 'Đang kiểm tra giao dịch…'
      : result.isError
        ? errorMessage(result.error)
        : !result.data.signatureValid
          ? 'Không xác minh được liên kết thanh toán.'
          : !result.data.attempt
            ? 'Không tìm thấy giao dịch.'
            : status === 'SUCCEEDED'
              ? 'Server đã ghi nhận thanh toán thành công.'
              : status === 'PENDING'
                ? 'Đang chờ ngân hàng xác nhận. Chưa cần thanh toán lại.'
                : status === 'EXPIRED'
                  ? 'Liên kết đã hết hạn nhưng kết quả thanh toán chưa được xác minh. Liên hệ cửa hàng để đối soát, không thanh toán lại ngay.'
                  : status === 'REQUIRES_REVIEW'
                    ? 'Giao dịch cần được cửa hàng đối soát.'
                    : 'Phiên thanh toán đã kết thúc. Vui lòng liên hệ cửa hàng để kiểm tra.'

  const isSuccess = status === 'SUCCEEDED'
  const isPending = status === 'PENDING' || result.isPending
  const isError =
    result.isError || !result.data?.signatureValid || status === 'FAILED' || status === 'EXPIRED'

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <header className="border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-base font-bold text-primary">
            <Coffee className="h-5 w-5" />
            <span>Coffee Shop</span>
          </Link>
          <Badge variant="outline" className="text-xs uppercase font-bold">
            {provider?.toUpperCase() ?? 'GATEWAY'}
          </Badge>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Card className="max-w-md w-full shadow-lg border-border text-center overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-5">
            {/* Status visual icon */}
            <div className="mx-auto flex items-center justify-center">
              {isSuccess ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
              ) : isPending ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-8 ring-amber-50/50">
                  <Clock className="h-10 w-10 animate-spin" />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
                  <XCircle className="h-10 w-10" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Kết quả thanh toán
              </h1>
              <p
                role={result.isError ? 'alert' : 'status'}
                className={cn(
                  'text-sm font-semibold',
                  isSuccess ? 'text-emerald-700' : isError ? 'text-rose-600' : 'text-amber-700',
                )}
              >
                {message}
              </p>
            </div>

            {/* Receipt Summary if attempt exists */}
            {result.data?.attempt && (
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-left text-xs space-y-2 tabular-nums">
                <div className="flex justify-between text-muted-foreground">
                  <span>Mã giao dịch:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {result.data.attempt.id.slice(0, 12)}…
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Mã hóa đơn:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {result.data.attempt.invoiceId.slice(0, 12)}…
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2.5">
              {supported && (
                <Button
                  variant="outline"
                  disabled={result.isFetching}
                  onClick={() => void result.refetch()}
                  className="w-full gap-2 font-semibold cursor-pointer"
                >
                  <RefreshCw className={cn('h-4 w-4', result.isFetching && 'animate-spin')} />
                  Kiểm tra lại
                </Button>
              )}
              <Link
                to="/"
                className={cn(buttonVariants({ variant: 'default' }), 'w-full font-bold shadow-xs cursor-pointer')}
              >
                Về thực đơn
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        <span>© 2026 Coffee Shop • Giao dịch thanh toán an toàn</span>
      </footer>
    </div>
  )
}
