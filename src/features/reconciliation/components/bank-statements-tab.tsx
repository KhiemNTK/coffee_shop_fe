import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  CheckCircle2,
  Download,
  RefreshCw,
  Upload,
} from 'lucide-react'
import type { Session } from '../../auth/session'
import { ApiError, errorMessage } from '@/shared/api/client'
import { pendingIntentKey, readPendingIntent, writePendingIntent, type PendingIntent } from '@/shared/api/pending-intent'
import { useRetryAfter } from '@/shared/api/use-retry-after'
import { ApiErrorAlert, Badge, Button, Card, CardContent, Dialog, Input } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { formatDate, formatVnd } from '@/shared/lib/format'
import { getFunds } from '../../cashier-shifts/cashier-shifts.api'
import {
  bankInputSchema,
  getBankEntries,
  getBankImports,
  ignoreBankEntry,
  importBankStatement,
  recoverBankStatement,
  reconcileBank,
  type BankEntry,
  type BankInput,
} from '../reconciliation.api'

export function BankStatementsTab() {
  const { employee, access } = useOutletContext<Session>()
  const can = access.has
  const [page, setPage] = useState(1)
  const [entryPage, setEntryPage] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const [fundId, setFundId] = useState('')
  const [preview, setPreview] = useState<BankInput | null>(null)
  const [fileError, setFileError] = useState('')
  const [ignore, setIgnore] = useState<BankEntry | null>(null)
  const [reason, setReason] = useState('')
  const client = useQueryClient()
  const recoveryKey = pendingIntentKey(employee.id, 'bank.statement.import')
  const [recovery] = useState(() => {
    try { return { intent: readPendingIntent(recoveryKey, bankInputSchema), error: '' } }
    catch { return { intent: null, error: 'Không đọc được phiếu đang nhập. Liên hệ quản lý để kiểm tra trước khi nhập tiếp.' } }
  })
  const [submitted, setSubmitted] = useState(recovery.intent)
  const [storageError, setStorageError] = useState(recovery.error)
  const [canResend, setCanResend] = useState(false)
  const flight = useRef(false)

  const funds = useQuery({
    queryKey: ['private', employee.id, 'bank-funds'],
    queryFn: ({ signal }) => getFunds({ type: 'BANK', itemPerPage: 100 }, signal),
    enabled: can('/funds_read'),
  })

  const imports = useQuery({
    queryKey: ['private', employee.id, 'bank-imports', page],
    queryFn: ({ signal }) => getBankImports(page, signal),
  })

  const entries = useQuery({
    queryKey: ['private', employee.id, 'bank-entries', selectedId, entryPage],
    queryFn: ({ signal }) => getBankEntries(selectedId, entryPage, signal),
    enabled: Boolean(selectedId),
  })

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['private', employee.id, 'bank-imports'] })
    void client.invalidateQueries({ queryKey: ['private', employee.id, 'bank-entries'] })
    void client.invalidateQueries({ queryKey: ['management-exceptions-list'] })
  }

  const importing = useMutation({
    retry: false,
    mutationFn: (intent: PendingIntent<BankInput>) => importBankStatement(intent.payload),
    onSuccess: finishImport,
    onError: (error, intent) => {
      if (!intent.uncertain && error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        sessionStorage.removeItem(recoveryKey)
        setSubmitted(null)
      } else setSubmitted({ ...intent, uncertain: true })
    },
    onSettled: () => { flight.current = false; refresh() },
  })
  const recovering = useMutation({
    retry: false,
    mutationFn: () => {
      if (!submitted) throw new Error('Không có phiếu cần kiểm tra.')
      return recoverBankStatement(submitted.payload)
    },
    onSuccess: finishImport,
    onError: error => {
      setCanResend(error instanceof ApiError && error.status === 404 && error.code === 'BANK_IMPORT_RECOVERY_NOT_FOUND')
    },
    onSettled: () => { flight.current = false },
  })
  const importWait = useRetryAfter(importing.error)
  const recoveryWait = useRetryAfter(recovering.error)
  const importBusy = importing.isPending || recovering.isPending
  const importLocked = importBusy || Boolean(submitted) || Boolean(recovery.error)

  function finishImport(result: Awaited<ReturnType<typeof importBankStatement>>) {
    sessionStorage.removeItem(recoveryKey)
    setSubmitted(null)
    setCanResend(false)
    setStorageError('')
    setPreview(null)
    setSelectedId(result.statementImport.id)
    setEntryPage(1)
    refresh()
  }
  function submitImport() {
    if (flight.current || !can('/bank-reconciliation_import') || !preview || recovery.error || (submitted && !canResend) || importWait > 0) return
    const intent = submitted ?? { payload: preview, createdAt: Date.now(), idempotencyKey: crypto.randomUUID() }
    // The server checksum permanently protects this exact statement, including recovery after a reload.
    try { writePendingIntent(recoveryKey, { ...intent, uncertain: true }) }
    catch { setStorageError('Không lưu được phiếu phục hồi. Chưa gửi; kiểm tra bộ nhớ trình duyệt.'); return }
    setSubmitted(intent)
    setStorageError('')
    setCanResend(false)
    recovering.reset()
    flight.current = true
    importing.mutate(intent)
  }
  function recoverImport() {
    if (flight.current || !can('/bank-reconciliation_import') || !submitted || recoveryWait > 0) return
    flight.current = true
    setCanResend(false)
    recovering.mutate()
  }

  const reconcile = useMutation({
    mutationFn: () => reconcileBank(selectedId),
    onSuccess: refresh,
  })

  const ignoring = useMutation({
    mutationFn: () => ignoreBankEntry(ignore!.id, reason.trim()),
    onSuccess: () => {
      setIgnore(null)
      refresh()
    },
  })

  async function readFile(file: File) {
    if (importLocked || flight.current) return
    setFileError('')
    setStorageError('')
    setPreview(null)
    importing.reset()
    if (file.size > 256_000) {
      setFileError('Sao kê vượt giới hạn 256 KB.')
      return
    }
    try {
      const parsed = bankInputSchema.safeParse({
        ...JSON.parse(await file.text()),
        fundId,
        sourceFileName: file.name,
      })
      if (!parsed.success) {
        setFileError(parsed.error.issues.map(e => e.path.join('.') + ': ' + e.message).join('; '))
        return
      }
      setPreview(parsed.data)
    } catch {
      setFileError('Không đọc được sao kê JSON.')
    }
  }

  function downloadTemplate() {
    const day = new Date().toISOString().slice(0, 10)
    const blob = new Blob(
      [
        JSON.stringify(
          {
            statementFrom: day + 'T00:00:00Z',
            statementTo: day + 'T23:59:59Z',
            entries: [
              {
                externalId: 'BANK-001',
                direction: 'CREDIT',
                amount: '100000',
                transactionDate: day + 'T12:00:00Z',
                bankReference: 'DEPOSIT-001',
                description: 'Nop tien ban giao',
              },
            ],
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'statement-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* Import statement card */}
      {can('/bank-reconciliation_import') && (
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end flex-1">
                <label className="min-w-0 flex-1 space-y-1.5">
                  <span className="text-xs font-semibold text-foreground">Quỹ ngân hàng</span>
                  {can('/funds_read') ? (
                    <select
                      value={fundId}
                      disabled={importLocked}
                      aria-label="Quỹ ngân hàng"
                      className="h-9 w-full rounded-lg border border-border/80 bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                      onChange={e => {
                        setFundId(e.target.value)
                        setPreview(null)
                      }}
                    >
                      <option value="">Chọn quỹ ngân hàng tiếp nhận...</option>
                      {funds.data?.list.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      aria-label="Quỹ ngân hàng"
                      value={fundId}
                      disabled={importLocked}
                      placeholder="Nhập ID quỹ..."
                      className="text-xs h-9"
                      onChange={e => {
                        setFundId(e.target.value)
                        setPreview(null)
                      }}
                    />
                  )}
                </label>

                <label className="min-w-0 flex-1 space-y-1.5">
                  <span className="text-xs font-semibold text-foreground">Sao kê JSON</span>
                  <input
                    type="file"
                    aria-label="Sao kê JSON"
                    accept=".json,application/json"
                    className="block w-full text-xs text-foreground file:mr-2.5 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
                    disabled={!fundId || importLocked}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) void readFile(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-1.5 text-xs h-9 shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Mẫu sao kê
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {(fileError || storageError || (importing.isError && !preview)) && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive">
          <p role="alert">{fileError || storageError || errorMessage(importing.error)}</p>
        </div>
      )}

      {submitted && !preview && (
        <div className="space-y-2 border-l-2 border-warning p-3 text-sm">
          <p role="status">Có phiếu nhập chưa rõ kết quả. Kiểm tra phiếu cũ trước khi nhập tiếp.</p>
          <Button variant="outline" onClick={() => setPreview(submitted.payload)}>Mở phiếu cần kiểm tra</Button>
        </div>
      )}
      {(importing.data?.replayed || recovering.isSuccess) && (
        <p role="status" className="text-sm">Đã tìm thấy phiếu gốc. Không nhập trùng; xem trạng thái các dòng bên dưới.</p>
      )}

      {importing.data?.reconciliationPending && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-800 dark:text-amber-300">
          <p role="alert">Đã nhập sao kê. Đối soát tự động chưa hoàn tất.</p>
        </div>
      )}

      {funds.isError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive">
          <p role="alert">{errorMessage(funds.error)}</p>
        </div>
      )}

      {/* Statement list */}
      <Card className="border border-border/80 bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border/70 p-4">
          <h2 className="text-base font-bold text-foreground">Lịch sử sao kê đã nhập</h2>
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5 text-xs h-8">
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
        </div>

        {imports.isError ? (
          <div className="p-6 text-center text-xs text-destructive">
            <p role="alert">{errorMessage(imports.error)}</p>
          </div>
        ) : imports.isPending ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            <p role="status">Đang tải danh sách sao kê...</p>
          </div>
        ) : imports.data.list.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            <p>Chưa có sao kê nào được tải lên.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {imports.data.list.map(item => (
              <button
                type="button"
                key={item.id}
                disabled={reconcile.isPending || ignoring.isPending}
                aria-pressed={selectedId === item.id}
                className={`flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left transition-colors ${
                  selectedId === item.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/30'
                }`}
                onClick={() => {
                  setSelectedId(item.id)
                  setEntryPage(1)
                  reconcile.reset()
                }}
              >
                <div className="space-y-0.5">
                  <span className="break-all font-semibold text-foreground text-sm block">
                    {item.sourceFileName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Kỳ: {formatDate(item.statementFrom)} → {formatDate(item.statementTo)}
                  </span>
                </div>
                <div className="text-right text-xs">
                  <span className="font-medium text-foreground block">{item.fund.name}</span>
                  <span className="text-muted-foreground font-mono">{formatDate(item.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {imports.data && imports.data.totalPages > 1 && (
          <div className="border-t border-border/70 p-3 flex justify-end">
            <Pagination page={page} totalPages={imports.data.totalPages} onPage={setPage} />
          </div>
        )}
      </Card>

      {/* Detail entries of selected statement */}
      {selectedId && (
        <section aria-label="Chi tiết sao kê" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-bold text-foreground">Giao dịch trong sao kê đã chọn</h3>
            {can('/bank-reconciliation_manage') && (
              <Button
                size="sm"
                disabled={reconcile.isPending}
                onClick={() => reconcile.mutate()}
                className="gap-1.5 bg-[#08634e] hover:bg-[#074b3d] text-white text-xs font-semibold"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${reconcile.isPending ? 'animate-spin' : ''}`} />
                Đối soát lại toàn bộ
              </Button>
            )}
          </div>

          {reconcile.isError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive">
              <p role="alert">{errorMessage(reconcile.error)}</p>
            </div>
          )}

          {reconcile.isSuccess && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
              <p role="status">Đối soát hoàn tất. Dữ liệu đã được cập nhật.</p>
            </div>
          )}

          {entries.isError ? (
            <div className="p-6 text-center text-xs text-destructive">
              <p role="alert">{errorMessage(entries.error)}</p>
            </div>
          ) : entries.isPending ? (
            <div className="p-10 text-center text-xs text-muted-foreground">
              <p role="status">Đang tải các dòng giao dịch...</p>
            </div>
          ) : entries.data.list.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground">
              <p>Sao kê này không có dòng giao dịch nào.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entries.data.list.map(entry => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-border/80 bg-card p-4 space-y-2 shadow-2xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-all font-mono text-xs font-bold text-foreground">
                      {entry.externalId}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-semibold ${
                        entry.matchStatus === 'MATCHED'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : entry.matchStatus === 'UNMATCHED'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                            : 'border-muted text-muted-foreground'
                      }`}
                    >
                      {entry.matchStatus}
                    </Badge>
                  </div>

                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-muted-foreground">{entry.direction}</span>
                    <span className="font-bold text-foreground font-mono">
                      {formatVnd(entry.amount)}
                    </span>
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    <span>{formatDate(entry.transactionDate)}</span>
                    {entry.bankReference && (
                      <span className="block font-mono truncate">Ref: {entry.bankReference}</span>
                    )}
                  </div>

                  {entry.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t border-border/50">
                      {entry.description}
                    </p>
                  )}

                  {entry.mismatchReason && (
                    <p className="break-words border-l-2 border-warning pl-2 text-xs text-foreground">
                      Lý do: {entry.mismatchReason}
                    </p>
                  )}

                  {can('/bank-reconciliation_manage') &&
                    (entry.matchStatus === 'UNMATCHED' || entry.matchStatus === 'MISMATCH') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIgnore(entry)
                          setReason('')
                          ignoring.reset()
                        }}
                        className="text-xs h-8 w-full mt-2"
                      >
                        Bỏ qua
                      </Button>
                    )}
                </div>
              ))}
            </div>
          )}

          {entries.data && entries.data.totalPages > 1 && (
            <div className="pt-2 flex justify-end">
              <Pagination page={entryPage} totalPages={entries.data.totalPages} onPage={setEntryPage} />
            </div>
          )}
        </section>
      )}

      {/* Preview Dialog */}
      {preview && (
        <Dialog
          open
          maxWidth="xl"
          onClose={() => {
            if (!importBusy) setPreview(null)
          }}
        >
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-bold text-foreground">{submitted ? 'Kiểm tra phiếu nhập' : 'Xác nhận nhập sao kê'}</h2>
            <p className="break-all text-xs text-muted-foreground">
              {preview.sourceFileName} · {preview.entries.length} giao dịch
            </p>
            {submitted && <p role="status" className="text-sm">Chưa rõ kết quả nhập. Kiểm tra phiếu gốc trước; nội dung đã được giữ nguyên.</p>}
            {storageError && <ApiErrorAlert error={storageError} />}
            {importing.isError && <ApiErrorAlert error={importing.error} />}
            {recovering.isError && !canResend && <ApiErrorAlert error={recovering.error} />}
            {canResend && <p role="status" className="text-sm">Chưa tìm thấy phiếu khớp. Bạn có thể gửi lại đúng nội dung này; hệ thống vẫn chống trùng.</p>}
            <div className="max-h-72 overflow-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[480px] text-xs">
                <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-2 text-left">Mã</th>
                    <th className="p-2 text-left">Chiều</th>
                    <th className="p-2 text-right">Số tiền</th>
                    <th className="p-2 text-left">Ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.entries.map(entry => (
                    <tr key={entry.externalId}>
                      <td className="p-2 font-mono">{entry.externalId}</td>
                      <td className="p-2">{entry.direction}</td>
                      <td className="p-2 text-right font-bold">{formatVnd(entry.amount)}</td>
                      <td className="p-2 text-muted-foreground">{formatDate(entry.transactionDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={importBusy}
                onClick={() => setPreview(null)}
                className="text-xs"
              >
                {submitted ? 'Đóng' : 'Hủy'}
              </Button>
              {submitted && <Button variant="outline" size="sm" disabled={importBusy || !can('/bank-reconciliation_import') || recoveryWait > 0} onClick={recoverImport}>
                <RefreshCw className="size-4" /> Kiểm tra phiếu đã nhập
              </Button>}
              <Button
                size="sm"
                disabled={importBusy || !can('/bank-reconciliation_import') || Boolean(recovery.error) || (Boolean(submitted) && !canResend) || importWait > 0}
                onClick={submitImport}
                className="gap-1.5 bg-[#08634e] hover:bg-[#074b3d] text-white text-xs font-semibold"
              >
                <Upload className="h-3.5 w-3.5" />
                {importing.isPending ? 'Đang nhập...' : submitted ? 'Gửi lại phiếu gốc' : 'Xác nhận nhập'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Ignore Dialog */}
      {ignore && (
        <Dialog
          open
          onClose={() => {
            if (!ignoring.isPending) setIgnore(null)
          }}
        >
          <form
            className="space-y-4 p-6"
            onSubmit={e => {
              e.preventDefault()
              ignoring.mutate()
            }}
          >
            <h2 className="text-lg font-bold text-foreground">
              Bỏ qua giao dịch {ignore.externalId}
            </h2>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-foreground">Lý do</span>
              <Input
                value={reason}
                disabled={ignoring.isPending}
                maxLength={500}
                required
                placeholder="Nhập lý do không đối soát dòng này..."
                onChange={e => setReason(e.target.value)}
                className="text-xs"
              />
            </label>
            {ignoring.isError && (
              <p role="alert" className="text-xs text-destructive">
                {errorMessage(ignoring.error)}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                disabled={ignoring.isPending || !reason.trim()}
                type="submit"
                className="gap-1.5 bg-[#08634e] hover:bg-[#074b3d] text-white text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Xác nhận bỏ qua
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  )
}
