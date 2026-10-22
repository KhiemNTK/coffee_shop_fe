import { formatVnd } from '../../shared/lib/format'
import type { BusinessInsight } from './business-insights.api'

const labels: Record<string, string> = {
  paidInvoiceCount: 'Hóa đơn đã thanh toán', grossSales: 'Doanh số trước giảm giá',
  discountAmount: 'Tiền giảm giá', refundCount: 'Giao dịch hoàn tiền thành công', refundAmount: 'Tiền đã hoàn',
  netReceipts: 'Thực thu sau hoàn tiền', estimatedNetSalesExTax: 'Doanh thu thuần ước tính chưa VAT',
  ingredientCost: 'Chi phí nguyên liệu đã chế biến', wasteCost: 'Chi phí hao hụt',
  estimatedGrossProfit: 'Lợi nhuận gộp ước tính', soldItemCount: 'Số dòng món đã bán',
  itemsWithCostSnapshot: 'Dòng món có snapshot chi phí', zeroCostSnapshotCount: 'Snapshot chi phí bằng 0',
}
const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium',
})
const countFormat = new Intl.NumberFormat('vi-VN')
export const insightTime = (iso: string) => dateFormat.format(new Date(iso))
export const insightMetricLabel = (metric: { key: string; label: string }) => Object.hasOwn(labels, metric.key) ? labels[metric.key] : metric.label
export const insightMetricValue = (value: string, unit: 'VND' | 'COUNT') => unit === 'VND' ? formatVnd(value) : countFormat.format(BigInt(value))

export function formatBusinessInsightText(job: BusinessInsight) {
  if (job.status !== 'COMPLETED' || !job.snapshot || !job.analysis) throw new Error('Insight is not complete')
  const snapshot = job.snapshot
  const metrics = new Map(snapshot.metrics.map(metric => [metric.key, metric]))
  return [
    'Coffee Homes - Phân tích kinh doanh',
    `Kỳ báo cáo: ${insightTime(job.period.from)} - ${insightTime(job.period.to)} (giờ Việt Nam)`,
    `Snapshot lúc: ${insightTime(snapshot.asOf)}`,
    `Kỳ so sánh: ${insightTime(snapshot.comparisonPeriod.from)} - ${insightTime(snapshot.comparisonPeriod.to)}`,
    `Mô hình: ${job.model} / ${job.promptVersion}`,
    'Nhận định AI chỉ mang tính tham khảo, không xác nhận nguyên nhân. Số liệu do hệ thống cung cấp.',
    'Doanh số theo ngày tạo hóa đơn; hoàn tiền của nhóm hóa đơn tính đến lúc snapshot, không phải dòng tiền trong kỳ. Hao hụt theo ngày ghi nhận.',
    'Chi tiết món/danh mục là top 5 theo doanh số trước giảm giá, thuế và hoàn tiền; phân loại theo catalog lúc snapshot, không phải lợi nhuận theo món.',
    '', job.analysis.summary, '',
    ...job.analysis.findings.flatMap((finding, index) => [
      `${index + 1}. ${finding.kind === 'HYPOTHESIS' ? 'Giả thuyết (chưa kiểm chứng)' : 'Quan sát hệ thống'}: ${finding.title}`,
      finding.detail,
      ...finding.metricKeys.map(key => {
        const metric = metrics.get(key)!
        return `${insightMetricLabel(metric)}: ${insightMetricValue(metric.value, metric.unit)}; kỳ trước: ${insightMetricValue(metric.previousValue, metric.unit)}`
      }),
      `Hành động đề xuất: ${finding.action}`, '',
    ]),
    'Giới hạn dữ liệu và phân tích:', ...job.analysis.limitations.map(limit => '- ' + limit),
  ].join('\n')
}
