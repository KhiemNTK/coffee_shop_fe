import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import type { Session } from '../../auth/session'
import { errorMessage } from '../../../shared/api/client'
import { Button } from '../../../shared/ui'
import { formatVnd } from '../../../shared/lib/format'
import { getOnlineJourney, getRecommendationExperiment } from '../online-business.api'

export function OnlineBusinessTab({ from, to }: { from: string; to: string }) {
  const { employee } = useOutletContext<Session>()
  const journey = useQuery({ queryKey: ['private', employee.id, 'online-journey', from, to], queryFn: ({ signal }) => getOnlineJourney(from, to, signal) })
  const experiment = useQuery({ queryKey: ['private', employee.id, 'recommendation-experiment', from, to], queryFn: ({ signal }) => getRecommendationExperiment(from, to, signal) })
  const summary = journey.data?.summary
  return <section className="space-y-6" aria-label="Hiệu quả đơn online">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Hành trình đơn mang đi</h2>
      <Button variant="outline" disabled={journey.isFetching || experiment.isFetching} onClick={() => { void journey.refetch(); void experiment.refetch() }}><RefreshCw size={16} />Làm mới số liệu</Button></div>
    {journey.isPending && <p role="status">Đang tải hành trình đơn…</p>}
    {journey.isError && <p role="alert">{errorMessage(journey.error)}</p>}
    {summary && !journey.isError && <>
      <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 lg:grid-cols-4">
        {[['Đơn gửi', summary.submittedCount], ['Đã tiếp nhận', summary.acceptedCount], ['Đã thanh toán', summary.paidCount], ['Đã nhận', summary.collectedCount],
          ['Thu ròng', formatVnd(summary.netReceipts)], ['Thu ròng đơn đã nhận', formatVnd(summary.collectedNetReceipts)],
          ['Gửi → Nhận', summary.requestToCollectionRatePercent === null ? '—' : summary.requestToCollectionRatePercent + '%'],
          ['Tỷ lệ vắng mặt', summary.noShowRatePercent === null ? '—' : summary.noShowRatePercent + '%']].map(([label, value]) =>
          <div key={String(label)} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="break-words text-lg font-semibold tabular-nums">{value}</dd></div>)}
      </dl>
      <p className="text-sm">Thời gian duyệt trung bình: {summary.averageReviewSeconds === null ? '—' : summary.averageReviewSeconds + ' giây'} · Chuẩn bị: {summary.averagePrepSeconds === null ? '—' : summary.averagePrepSeconds + ' giây'}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Ngày tạo đơn</th><th className="p-2">Gửi</th><th className="p-2">Tiếp nhận</th><th className="p-2">Đã nhận</th><th className="p-2">Vắng mặt</th><th className="p-2">Thu ròng</th></tr></thead>
        <tbody>{journey.data!.trend.map(row => <tr key={row.bucket} className="border-b"><td className="p-2 whitespace-nowrap">{row.bucket}</td><td className="p-2">{row.submittedCount}</td><td className="p-2">{row.acceptedCount}</td><td className="p-2">{row.collectedCount}</td><td className="p-2">{row.noShowCount}</td><td className="p-2 whitespace-nowrap">{formatVnd(row.netReceipts)}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">Nhóm theo ngày tạo yêu cầu; thu ròng đã trừ hoàn tiền. Đơn chưa nhận vẫn có thể thay đổi kết quả.</p>
    </>}
    <section className="space-y-3 border-t border-border pt-5" aria-label="Thử nghiệm gợi ý món">
      <h2 className="text-lg font-semibold">Hiệu quả gợi ý món</h2>
      {experiment.isPending && <p role="status">Đang tải thử nghiệm…</p>}
      {experiment.isError && <p role="alert">{errorMessage(experiment.error)}</p>}
      {experiment.data && !experiment.isError && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Nhóm</th><th className="p-2">Lượt phân nhóm</th><th className="p-2">Đơn trả tiền</th><th className="p-2">Tỷ lệ trả tiền</th><th className="p-2">Đơn có món gợi ý</th><th className="p-2">Thu / Lượt phân nhóm</th></tr></thead>
        <tbody>{experiment.data.variants.map(row => <tr key={row.variant} className="border-b"><td className="p-2 whitespace-nowrap">{row.variant === 'CONTROL' ? 'Đối chứng' : 'Có gợi ý'}</td><td className="p-2">{row.assignments}</td><td className="p-2">{row.paidOrders}</td><td className="p-2">{row.assignments ? (row.paidConversionRate * 100).toFixed(2) + '%' : '—'}</td><td className="p-2">{row.attachedOrders}</td><td className="p-2 whitespace-nowrap">{formatVnd(row.revenuePerAssignment)}</td></tr>)}</tbody></table></div>}
      <p className="text-xs text-muted-foreground">Số liệu mô tả, chưa phải kết luận thống kê về tác động của gợi ý.</p>
    </section>
  </section>
}
