import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { z } from 'zod'
import { RefreshCw, Star } from 'lucide-react'
import type { Session } from '../../auth/session'
import { apiGet, errorMessage } from '../../../shared/api/client'
import { Button } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'

const summarySchema = z.object({
  total: z.number(),
  averageRating: z.number().nullable(),
  ratings: z.array(z.object({ rating: z.number(), count: z.number() })),
})
const feedbackPageSchema = z.object({
  list: z.array(
    z.object({
      id: z.string(),
      rating: z.number(),
      comment: z.string().nullable(),
      createdAt: z.string(),
      invoice: z.object({ invoiceNumber: z.string() }),
    }),
  ),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})

export function FeedbackReport({ from, to }: { from: string; to: string }) {
  const { employee } = useOutletContext<Session>()
  const [page, setPage] = useState(1)
  const [rating, setRating] = useState('')
  const period = new URLSearchParams({ from, to })
  const summary = useQuery({
    queryKey: ['private', employee.id, 'feedback-summary', from, to],
    queryFn: ({ signal }) =>
      apiGet(
        `/orders/takeaway/feedback/summary?${period}`,
        summarySchema,
        signal,
        true,
      ),
  })
  const feedback = useQuery({
    queryKey: [
      'private',
      employee.id,
      'feedback-history',
      from,
      to,
      rating,
      page,
    ],
    queryFn: ({ signal }) =>
      apiGet(
        `/orders/takeaway/feedback?${period}&page=${page}&itemPerPage=20${rating ? `&rating=${rating}` : ''}`,
        feedbackPageSchema,
        signal,
        true,
      ),
  })
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Phản hồi đơn mang đi</h2>
        <Button
          variant="outline"
          size="sm"
          aria-label="Làm mới phản hồi"
          disabled={summary.isFetching || feedback.isFetching}
          onClick={() => {
            void summary.refetch()
            void feedback.refetch()
          }}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {(summary.isError || feedback.isError) && (
        <p role="alert" className="text-destructive">
          {errorMessage(summary.error ?? feedback.error)}
        </p>
      )}
      {summary.isPending && <p role="status">Đang tải tổng hợp đánh giá…</p>}
      {summary.data && (
        <div className="flex flex-wrap items-center gap-4 border-y py-3 text-sm">
          <strong className="flex items-center gap-2">
            <Star size={16} />
            {summary.data.averageRating ?? '—'} / 5
          </strong>
          <span>{summary.data.total} đánh giá</span>
          {summary.data.ratings.map((item) => (
            <span key={item.rating}>
              {item.rating} sao: {item.count}
            </span>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        Điểm đánh giá
        <select
          className="rounded-md border bg-background p-2"
          value={rating}
          onChange={(event) => {
            setRating(event.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} sao
            </option>
          ))}
        </select>
      </label>
      {feedback.isPending && <p role="status">Đang tải phản hồi…</p>}
      <ul className="divide-y">
        {feedback.data?.list.map((item) => (
          <li key={item.id} className="space-y-1 py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>
                {item.invoice.invoiceNumber} · {item.rating} sao
              </strong>
              <time className="text-muted-foreground">
                {new Date(item.createdAt).toLocaleString('vi-VN')}
              </time>
            </div>
            <p className="break-words">{item.comment || 'Không có nhận xét'}</p>
          </li>
        ))}
      </ul>
      {feedback.isSuccess && !feedback.data.list.length && (
        <p className="text-sm text-muted-foreground">
          Không có phản hồi trong kỳ này.
        </p>
      )}
      <Pagination
        page={page}
        totalPages={feedback.data?.totalPages ?? 0}
        onPage={setPage}
        disabled={feedback.isFetching}
      />
    </section>
  )
}
