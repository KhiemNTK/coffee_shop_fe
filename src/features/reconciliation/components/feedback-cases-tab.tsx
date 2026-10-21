import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { z } from 'zod'
import type { Session } from '../../auth/session'
import { apiGet, errorMessage } from '@/shared/api/client'
import { paginatedResponseSchema } from '@/shared/api/types'
import { Badge, Button, Card, Dialog, Input } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { formatDate } from '@/shared/lib/format'
import { resolveFeedback } from '../reconciliation.api'
import { useTranslation } from 'react-i18next'

const feedbackSchema = z.object({
  id: z.string(),
  invoice: z.object({ invoiceNumber: z.string() }),
  rating: z.number(),
  comment: z.string().nullable(),
  createdAt: z.string(),
})

export function FeedbackCasesTab() {
  const { t } = useTranslation()
  const { employee, authorization } = useOutletContext<Session>()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<z.infer<typeof feedbackSchema> | null>(null)
  const [note, setNote] = useState('')
  const [customerReply, setCustomerReply] = useState('')

  const query = useQuery({
    queryKey: ['private', employee.id, 'feedback-cases', page],
    queryFn: ({ signal }) =>
      apiGet(
        '/orders/takeaway/feedback/cases?page=' + page + '&itemPerPage=20',
        paginatedResponseSchema(feedbackSchema),
        signal,
        true
      ),
  })

  const client = useQueryClient()
  const mutation = useMutation({
    retry: false,
    mutationFn: (intent: { id: string; note: string; customerReply: string }) => resolveFeedback(intent.id, intent.note, intent.customerReply),
    onSuccess: () => {
      setSelected(null)
      void query.refetch()
      void client.invalidateQueries({ queryKey: ['management-exceptions-list'] })
      void client.invalidateQueries({ queryKey: ['management-exceptions-summary'] })
    },
  })

  return (
    <div className="space-y-4">
      <Card className="border border-border/80 bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border/70 p-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Phản hồi &amp; Khiếu nại của khách hàng</h2>
            <p className="text-xs text-muted-foreground">Theo dõi phản hồi đơn mang về và đánh giá dịch vụ</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
        </div>

        {query.isError ? (
          <div className="p-6 text-center text-xs text-destructive">
            <p role="alert">{errorMessage(query.error)}</p>
          </div>
        ) : query.isPending ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            <p role="status">Đang tải danh sách khiếu nại...</p>
          </div>
        ) : query.data.list.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            <p>Không có khiếu nại chưa xử lý.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {query.data.list.map(item => (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-600 text-xs">{item.rating} ★</span>
                    <span className="text-xs text-muted-foreground font-mono">· {formatDate(item.createdAt)}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {item.invoice.invoiceNumber}
                    </Badge>
                  </div>
                  <p className="break-words font-medium text-foreground text-sm">
                    {item.comment || 'Không có bình luận'}
                  </p>
                </div>

                {authorization.permissionKeys.includes('/feedback_resolve') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelected(item)
                      setNote('')
                      setCustomerReply('')
                      mutation.reset()
                    }}
                    className="text-xs h-8 shrink-0 hover:bg-primary/5 hover:text-primary"
                  >
                    Xử lý
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {query.data && query.data.totalPages > 1 && (
          <div className="border-t border-border/70 p-3 flex justify-end">
            <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} />
          </div>
        )}
      </Card>

      {/* Resolve Feedback Dialog */}
      {selected && (
        <Dialog
          open
          onClose={() => {
            if (!mutation.isPending) setSelected(null)
          }}
        >
          <form
            className="space-y-4 p-6"
            onSubmit={e => {
              e.preventDefault()
              if (!mutation.isPending) mutation.mutate(mutation.variables ?? { id: selected.id, note: note.trim(), customerReply })
            }}
          >
            <h2 className="text-lg font-bold text-foreground">Xác nhận xử lý khiếu nại</h2>
            <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1 border">
              <p className="font-semibold text-foreground">Hóa đơn: {selected.invoice.invoiceNumber}</p>
              <p className="text-muted-foreground">{selected.comment}</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-foreground">{t('feedback.internalNote')}</span>
              <Input
                required
                maxLength={500}
                value={note}
                disabled={mutation.isPending || mutation.isError}
                placeholder="Nhập nội dung đã hỗ trợ khách hàng..."
                onChange={e => setNote(e.target.value)}
                className="text-xs"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span>{t('feedback.customerReply')}</span>
              <Input maxLength={500} value={customerReply} disabled={mutation.isPending || mutation.isError} onChange={event => setCustomerReply(event.target.value)} />
            </label>
            {mutation.isError && (
              <p role="alert" className="text-xs text-destructive">
                {errorMessage(mutation.error)}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="submit"
                disabled={!note.trim() || mutation.isPending}
                className="gap-1.5 bg-[#08634e] hover:bg-[#074b3d] text-white text-xs font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Xác nhận đã xử lý
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  )
}
