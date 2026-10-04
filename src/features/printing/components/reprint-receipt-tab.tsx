import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Receipt,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react'
import { errorMessage } from '@/shared/api/client'
import {
  printingApi,
  type PrintDevice,
} from '../printing.api'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@/shared/ui'

interface ReprintReceiptTabProps {
  devices: PrintDevice[]
}

export function ReprintReceiptTab({ devices }: ReprintReceiptTabProps) {
  const queryClient = useQueryClient()

  const [reprintInvoiceId, setReprintInvoiceId] = useState('')
  const [reprintReason, setReprintReason] = useState('')
  const [reprintCopies, setReprintCopies] = useState(1)
  const [reprintDeviceId, setReprintDeviceId] = useState('')
  const [reprintSuccessMsg, setReprintSuccessMsg] = useState<string | null>(null)
  const [reprintErrorMsg, setReprintErrorMsg] = useState<string | null>(null)

  const reprintMutation = useMutation({
    mutationFn: ({
      invoiceId,
      dto,
    }: {
      invoiceId: string
      dto: Parameters<typeof printingApi.reprintReceipt>[1]
    }) => printingApi.reprintReceipt(invoiceId, dto),
    onSuccess: (data) => {
      setReprintSuccessMsg(
        `Đã tạo lệnh in lại thành công (Mã lệnh: ${data.id}). Print Agent sẽ nhận và xuất biên lai ngay.`,
      )
      setReprintErrorMsg(null)
      setReprintInvoiceId('')
      setReprintReason('')
      setReprintCopies(1)
      setReprintDeviceId('')
      void queryClient.invalidateQueries({ queryKey: ['print-jobs'] })
    },
    onError: (err) => {
      setReprintErrorMsg(errorMessage(err))
      setReprintSuccessMsg(null)
    },
  })

  return (
    <Card className="max-w-xl mx-auto border border-border shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Gửi yêu cầu In lại Hóa đơn
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Chỉ áp dụng cho các hóa đơn đã thanh toán thành công (PAID / PARTIALLY_REFUNDED / REFUNDED)
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-xs">
        {reprintSuccessMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-3 text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{reprintSuccessMsg}</span>
          </div>
        )}

        {reprintErrorMsg && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 p-3 text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{reprintErrorMsg}</span>
          </div>
        )}

        <div>
          <label htmlFor="reprint-invoice-id" className="block font-medium text-foreground pb-1">
            Mã Hóa đơn (Invoice ID UUID) <span className="text-rose-500">*</span>
          </label>
          <Input
            id="reprint-invoice-id"
            placeholder="Nhập mã UUID hóa đơn (VD: 10000000-0000-4000-8000-...)"
            value={reprintInvoiceId}
            onChange={(e) => setReprintInvoiceId(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        <div>
          <label htmlFor="reprint-reason" className="block font-medium text-foreground pb-1">
            Lý do in lại <span className="text-rose-500">*</span> (Tối thiểu 3 ký tự)
          </label>
          <Input
            id="reprint-reason"
            placeholder="VD: Khách xin thêm hóa đơn, máy in kẹt giấy, phiếu bị rách..."
            value={reprintReason}
            onChange={(e) => setReprintReason(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="reprint-copies" className="block font-medium text-foreground pb-1">
              Số lượng bản in
            </label>
            <select
              id="reprint-copies"
              value={reprintCopies}
              onChange={(e) => setReprintCopies(Number(e.target.value))}
              className="w-full h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              <option value={1}>1 bản</option>
              <option value={2}>2 bản</option>
              <option value={3}>3 bản</option>
              <option value={4}>4 bản</option>
              <option value={5}>5 bản</option>
            </select>
          </div>

          <div>
            <label htmlFor="reprint-device" className="block font-medium text-foreground pb-1">
              Máy in xuất hóa đơn
            </label>
            <select
              id="reprint-device"
              value={reprintDeviceId}
              onChange={(e) => setReprintDeviceId(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              <option value="">Máy in mặc định quầy thu ngân</option>
              {devices
                .filter((d) => d.type === 'RECEIPT' && d.isActive)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.paperSize})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="pt-2">
          <Button
            disabled={
              !reprintInvoiceId.trim() ||
              reprintReason.trim().length < 3 ||
              reprintMutation.isPending
            }
            onClick={() => {
              reprintMutation.mutate({
                invoiceId: reprintInvoiceId.trim(),
                dto: {
                  reason: reprintReason.trim(),
                  copies: reprintCopies,
                  deviceId: reprintDeviceId || undefined,
                  idempotencyKey: crypto.randomUUID(),
                },
              })
            }}
            className="w-full gap-2 h-9 bg-primary text-primary-foreground"
          >
            {reprintMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>Gửi lệnh in lại hóa đơn</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
