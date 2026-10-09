import { AlertTriangle, CalendarCheck, CheckCircle2, RefreshCw } from 'lucide-react'
import { type DailySalesClose } from '../reports.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import { formatDateTime } from '../../../shared/lib/format'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '../../../shared/ui'

interface DailySalesCloseTabProps {
  selectedCloseDate: string
  setSelectedCloseDate: (date: string) => void
  dailyCloseData: DailySalesClose | null | undefined
  isPending: boolean
  isFetching: boolean
  readError: unknown
  onRefetch: () => void
  canClose: boolean
  confirmCloseModalOpen: boolean
  setConfirmCloseModalOpen: (open: boolean) => void
  onExecuteClose: () => void
  isClosePending: boolean
  isCloseError: boolean
  closeError: unknown
}

export function DailySalesCloseTab({
  selectedCloseDate,
  setSelectedCloseDate,
  dailyCloseData,
  isPending,
  isFetching,
  readError,
  onRefetch,
  canClose,
  confirmCloseModalOpen,
  setConfirmCloseModalOpen,
  onExecuteClose,
  isClosePending,
  isCloseError,
  closeError,
}: DailySalesCloseTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-3">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Chứng từ & Thao tác Chốt sổ ngày (Daily Sales Close)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chốt sổ doanh thu toàn quán theo ngày kinh doanh chuẩn giờ Việt Nam. Yêu cầu toàn bộ ca
              thu ngân đã đóng.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Input
              type="date"
              aria-label="Ngày chốt sổ"
              disabled={confirmCloseModalOpen || isClosePending}
              value={selectedCloseDate}
              onChange={(e) => setSelectedCloseDate(e.target.value)}
              className="w-44 text-xs h-9"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onRefetch}
              disabled={isFetching}
            >
              Kiểm tra
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {readError ? <p role="alert" className="text-sm text-destructive">{errorMessage(readError)}</p> : isPending ? (
            <div className="py-12 text-center text-muted-foreground animate-pulse text-xs">
              Đang kiểm tra chứng từ chốt sổ ngày {selectedCloseDate}...
            </div>
          ) : dailyCloseData ? (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Ngày {dailyCloseData.businessDate} đã được chốt sổ thành công
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Thời điểm chốt: {formatDateTime(dailyCloseData.closedAt)} |
                    Mã nhân viên thực hiện: {dailyCloseData.closedById}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border pt-4 sm:grid-cols-2">
                {([
                  ['Doanh thu gộp', dailyCloseData.snapshot.grossSales],
                  ['Giảm giá', dailyCloseData.snapshot.discountAmount],
                  ['Thuế', dailyCloseData.snapshot.taxAmount],
                  ['Hoàn tiền tại thời điểm chốt', dailyCloseData.snapshot.refundAmount],
                  ['Thực thu', dailyCloseData.snapshot.netReceipts],
                  ['Doanh thu chưa thuế ước tính', dailyCloseData.snapshot.estimatedNetSalesExTax],
                  ['Chi phí nguyên liệu', dailyCloseData.snapshot.ingredientCost],
                  ['Chi phí hao hụt', dailyCloseData.snapshot.wasteCost],
                  ['Lợi nhuận gộp ước tính', dailyCloseData.snapshot.estimatedGrossProfit],
                ] as const).map(([label, amount]) => <div key={label} className="flex min-w-0 flex-wrap justify-between gap-2 text-sm">
                  <dt>{label}</dt><dd className="font-semibold">{formatPrice(amount)}</dd>
                </div>)}
              </dl>
              <p className="text-sm">{dailyCloseData.snapshot.paidInvoiceCount} hóa đơn · {dailyCloseData.snapshot.refundCount} lần hoàn tiền · {dailyCloseData.snapshot.soldItemCount} dòng món bán</p>
              <p className="text-sm">Dòng món có snapshot giá vốn: {dailyCloseData.snapshot.itemsWithCostSnapshot}/{dailyCloseData.snapshot.soldItemCount} · Snapshot giá vốn bằng 0: {dailyCloseData.snapshot.zeroCostSnapshotCount}</p>

              {dailyCloseData.refundDeltaSinceClose && (
                <div className="border-t border-border pt-3 text-xs space-y-1">
                  <p className="font-semibold text-foreground">Biến động phát sinh sau khi chốt sổ:</p>
                  <p className="text-muted-foreground">
                    Hoàn tiền sau chốt: {dailyCloseData.refundDeltaSinceClose.count} giao dịch (
                    {formatPrice(String(dailyCloseData.refundDeltaSinceClose.amount))})
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Ngày {selectedCloseDate} chưa thực hiện chốt sổ
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Khi ngày kinh doanh kết thúc và các ca thu ngân đều đã đóng, bạn có thể thực
                    hiện chốt sổ để khóa dữ liệu tài chính.
                  </p>
                </div>
              </div>

              {canClose && (
                <div className="pt-2">
                  <Button
                    onClick={() => setConfirmCloseModalOpen(true)}
                    className="gap-2"
                  >
                    <CalendarCheck className="h-4 w-4" />
                    Tiến hành Chốt sổ ngày {selectedCloseDate}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: XÁC NHẬN CHỐT SỔ NGÀY */}
      {confirmCloseModalOpen && (
        <Dialog open onOpenChange={() => { if (!isClosePending) setConfirmCloseModalOpen(false) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-primary flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" />
                Xác nhận chốt sổ ngày {selectedCloseDate}
              </DialogTitle>
              <DialogDescription>
                Thao tác này sẽ khóa toàn bộ số liệu doanh thu và ghi lại snapshot tài chính của
                ngày {selectedCloseDate}. Hãy chắc chắn rằng tất cả nhân viên thu ngân đã đóng ca làm
                việc.
              </DialogDescription>
            </DialogHeader>

            {isCloseError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                {errorMessage(closeError)}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmCloseModalOpen(false)}
                disabled={isClosePending}
              >
                Hủy
              </Button>
              <Button
                onClick={onExecuteClose}
                disabled={isClosePending}
                className="gap-2"
              >
                {isClosePending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isClosePending ? 'Đang xử lý...' : 'Xác nhận Chốt sổ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
