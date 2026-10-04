import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { z } from 'zod'
import { apiGet, errorMessage } from '../../shared/api/client'
import { Button } from '../../shared/ui'

const resultSchema = z.object({
  signatureValid: z.boolean(),
  attempt: z.object({
    id: z.string(), invoiceId: z.string(),
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
    refetchInterval: (query) => query.state.data?.attempt?.status === 'PENDING' &&
      Date.now() - startedAt < 30_000 ? 3000 : false,
  })
  const status = result.data?.attempt?.status
  const message = !supported ? 'Cổng thanh toán không hợp lệ.'
    : result.isPending ? 'Đang kiểm tra giao dịch…'
    : result.isError ? errorMessage(result.error)
    : !result.data.signatureValid ? 'Không xác minh được liên kết thanh toán.'
    : !result.data.attempt ? 'Không tìm thấy giao dịch.'
    : status === 'SUCCEEDED' ? 'Server đã ghi nhận thanh toán thành công.'
    : status === 'PENDING' ? 'Đang chờ ngân hàng xác nhận. Chưa cần thanh toán lại.'
    : status === 'REQUIRES_REVIEW' ? 'Giao dịch cần được cửa hàng đối soát.'
    : 'Phiên thanh toán đã kết thúc. Vui lòng liên hệ cửa hàng để kiểm tra.'

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-12">
      <Link to="/" className="font-semibold text-primary">Coffee Shop</Link>
      <h1 className="text-2xl font-bold">Kết quả thanh toán</h1>
      <p role={result.isError ? 'alert' : 'status'}>{message}</p>
      {supported && <Button variant="outline" disabled={result.isFetching} onClick={() => void result.refetch()}>Kiểm tra lại</Button>}
      <Link to="/" className="block text-sm font-semibold text-primary">Về thực đơn</Link>
    </main>
  )
}
