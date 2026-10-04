import { ChefHat, Clock } from 'lucide-react'
import {
  type KitchenBottleneckSlot,
  type KitchenSlaStation,
} from '../reports.api'
import { errorMessage } from '../../../shared/api/client'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui'

interface KitchenOperationsTabProps {
  slaStations?: KitchenSlaStation[]
  isSlaPending: boolean
  isSlaError: boolean
  slaError: unknown
  bottleneckSlots?: KitchenBottleneckSlot[]
  isBottlenecksPending: boolean
  bottlenecksError: unknown
}

export function KitchenOperationsTab({
  slaStations,
  isSlaPending,
  isSlaError,
  slaError,
  bottleneckSlots,
  isBottlenecksPending,
  bottlenecksError,
}: KitchenOperationsTabProps) {
  return (
    <div className="space-y-6">
      {/* Station SLA Compliance Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground">
            Hiệu suất chế biến & Tuân thủ SLA Quầy Bếp
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isSlaPending ? (
            <div className="p-12 text-center text-muted-foreground animate-pulse">
              Đang tính toán chỉ số SLA quầy bếp...
            </div>
          ) : isSlaError ? (
            <div className="p-8 text-center text-destructive">
              {errorMessage(slaError)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Quầy chế biến</th>
                    <th className="px-4 py-3 text-right">Tổng vé nhận</th>
                    <th className="px-4 py-3 text-right">Vé hoàn thành</th>
                    <th className="px-4 py-3 text-right">Hoàn thành trễ</th>
                    <th className="px-4 py-3 text-right">Đang trễ</th>
                    <th className="px-4 py-3 text-center">Tỷ lệ trễ</th>
                    <th className="px-4 py-3 text-right">TG làm món TB</th>
                    <th className="px-4 py-3 text-right">P95 (95% vé)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {slaStations?.map((st, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-foreground flex items-center gap-2">
                        <ChefHat className="h-4 w-4 text-primary" />
                        {st.stationName}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium">{st.ticketCount}</td>
                      <td className="px-4 py-3.5 text-right text-emerald-600 font-semibold">
                        {st.completedCount}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-destructive">
                        {st.lateCompletedCount}
                      </td>
                      <td className="px-4 py-3.5 text-right">{st.overdueOpenCount}</td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge
                          variant={Number(st.lateRatePercent) > 10 ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {st.lateRatePercent === null ? '—' : st.lateRatePercent + '%'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs">
                        {st.averageTicketToReadySeconds !== null &&
                        st.averageTicketToReadySeconds !== undefined
                          ? `${Math.floor(st.averageTicketToReadySeconds / 60)} phút ${st.averageTicketToReadySeconds % 60}s`
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                        {st.p95TicketToReadySeconds !== null &&
                        st.p95TicketToReadySeconds !== undefined
                          ? `${Math.round(st.p95TicketToReadySeconds / 60)} phút`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {!slaStations?.length && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                        Chưa có dữ liệu vé bếp trong khoảng thời gian này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kitchen Bottlenecks Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            Cảnh báo Khung giờ Nút thắt Cổ chai (Live Bottlenecks)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bottlenecksError ? <p role="alert" className="p-4 text-sm text-destructive">{errorMessage(bottlenecksError)}</p> : isBottlenecksPending ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse text-xs">
              Đang phân tích các khung giờ nghẽn...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Khung giờ</th>
                    <th className="px-4 py-3">Quầy</th>
                    <th className="px-4 py-3 text-right">Tổng món yêu cầu</th>
                    <th className="px-4 py-3 text-right">Vé trễ SLA</th>
                    <th className="px-4 py-3 text-center">Tỷ lệ trễ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bottleneckSlots
                    ?.filter((slot) => slot.lateCompletedCount > 0 || slot.overdueOpenCount > 0)
                    .slice(0, 10)
                    .map((slot, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">
                          {new Date(slot.bucketStartAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-3 text-xs">{slot.stationName}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {slot.orderedUnitCount ?? slot.ticketCount}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-destructive">
                          {slot.lateCompletedCount + slot.overdueOpenCount}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="destructive" className="text-xs">
                            {slot.lateRatePercent === null ? '—' : slot.lateRatePercent + '%'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  {!bottleneckSlots?.some((s) => s.lateCompletedCount > 0 || s.overdueOpenCount > 0) && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-emerald-600">
                        Không phát hiện khung giờ nút thắt cổ chai nào nghiêm trọng.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
