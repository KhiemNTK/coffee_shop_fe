import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Download, RefreshCw, Upload, Eye } from 'lucide-react'
import { z } from 'zod'
import type { Session } from '../auth/session'
import { apiGet } from '@/shared/api/client'
import { errorMessage } from '@/shared/api/client'
import { paginatedResponseSchema } from '@/shared/api/types'
import { Button, Dialog, Input, Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { formatVnd, formatDate } from '@/shared/lib/format'
import { getFunds } from '../cashier-shifts/cashier-shifts.api'
import { reconcilePaymentAttempt } from '../invoices/invoices.api'
import { bankInputSchema, getIncidents, closeIncident, getBankImports, getBankEntries,
  importBankStatement, reconcileBank, ignoreBankEntry, resolveFeedback,
  type BankInput, type Incident, type BankEntry } from './reconciliation.api'

export default function ReconciliationPage() {
  const session = useOutletContext<Session>()
  const can = (key: string) => session.authorization.permissionKeys.includes(key)
  const [params] = useSearchParams()
  const tabs = [can('/payment-reconciliation_read') && 'payments', can('/bank-reconciliation_read') && 'bank',
    can('/reports_read') && 'feedback'].filter(Boolean) as string[]
  const [tab, setTab] = useState(tabs.includes(params.get('tab') || '') ? params.get('tab')! : (tabs[0] ?? ''))
  return <section className="space-y-4">
    <h1 className="text-2xl font-semibold">Đối soát & Khiếu nại</h1>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="flex-wrap">
        {tabs.includes('payments') && <TabsTrigger value="payments">Sự cố thanh toán</TabsTrigger>}
        {tabs.includes('bank') && <TabsTrigger value="bank">Sao kê ngân hàng</TabsTrigger>}
        {tabs.includes('feedback') && <TabsTrigger value="feedback">Phản hồi khách</TabsTrigger>}
      </TabsList>
      <TabsContent value="payments"><PaymentIncidents /></TabsContent>
      <TabsContent value="bank"><BankStatements /></TabsContent>
      <TabsContent value="feedback"><FeedbackCases /></TabsContent>
    </Tabs>
  </section>
}

function PaymentIncidents() {
  const { employee, authorization } = useOutletContext<Session>()
  const canManage = authorization.permissionKeys.includes('/payment-reconciliation_manage')
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('OPEN')
  const [selected, setSelected] = useState<Incident | null>(null)
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<'RESOLVE' | 'IGNORE' | null>(null)
  const query = useQuery({ queryKey: ['private', employee.id, 'reconciliation', status, page],
    queryFn: ({ signal }) => getIncidents(page, status, signal) })
  const action = useMutation({
    mutationFn: async (command: 'RESOLVE' | 'IGNORE' | 'RECONCILE') => {
      if (!selected) throw new Error('Chưa chọn sự cố.')
      return command === 'RECONCILE' ? reconcilePaymentAttempt(selected.paymentAttemptId) :
        closeIncident(selected.id, command, note.trim())
    },
    onSuccess: (_data, command) => {
      setConfirm(null)
      if (command !== 'RECONCILE') setSelected(null)
      void query.refetch()
      void client.invalidateQueries({ queryKey: ['management-exceptions-list'] })
      void client.invalidateQueries({ queryKey: ['management-exceptions-summary'] })
    },
  })
  return <div className="space-y-3">
    <label>Trạng thái <select className="rounded border p-2" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
      <option value="OPEN">Chưa xử lý</option><option value="RESOLVED">Đã xử lý</option><option value="IGNORED">Đã bỏ qua</option><option value="">Tất cả</option>
    </select></label>
    {query.isError ? <p role="alert">{errorMessage(query.error)}</p> : query.isPending ? <p role="status">Đang tải...</p> :
      query.data.list.length === 0 ? <p>Không có sự cố.</p> : query.data.list.map(item => <div className="flex justify-between gap-3 border-b py-3" key={item.id}>
        <div className="min-w-0"><p className="break-words font-medium">{item.title}</p><p>{item.paymentAttempt.merchantReference} · {formatVnd(item.paymentAttempt.amount)}</p>
          <p className="text-sm">{item.status} · {item.paymentAttempt.status}</p></div>
        <Button variant="outline" onClick={() => { setSelected(item); setNote(''); setConfirm(null); action.reset() }}><Eye className="h-4 w-4" />Chi tiết</Button>
      </div>)}
    <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" />Làm mới</Button>
    {query.data && <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} />}
    {selected && <Dialog open onClose={() => { if (!action.isPending) setSelected(null) }}>
      <div className="space-y-4 p-5"><h2 className="pr-8 text-lg font-semibold">{selected.title}</h2>
        <p className="break-all">Hóa đơn: {selected.paymentAttempt.invoiceId}</p>
        <p>Trạng thái gần nhất: {selected.paymentAttempt.status}</p>
        {selected.resolutionNote && <p>{selected.resolutionNote}</p>}
        {action.isError && <p role="alert">{errorMessage(action.error)}</p>}
        {action.isSuccess && <p role="status">Đã kiểm tra lại payment. Làm mới danh sách để xem kết quả.</p>}
        {canManage && selected.status === 'OPEN' && <>
          <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate('RECONCILE')}><RefreshCw className="h-4 w-4" />Đối soát lại</Button>
          <label className="block">Lý do xử lý<Input value={note} maxLength={500} disabled={action.isPending}
            onChange={e => { setNote(e.target.value); setConfirm(null) }} /></label>
          {confirm ? <div className="space-y-2"><p>Xác nhận {confirm === 'IGNORE' ? 'bỏ qua' : 'đóng'} sự cố?</p>
            <Button disabled={action.isPending} onClick={() => action.mutate(confirm)}><CheckCircle2 className="h-4 w-4" />Xác nhận</Button>
            <Button variant="outline" disabled={action.isPending} onClick={() => setConfirm(null)}>Quay lại</Button></div> :
            <div className="flex flex-wrap gap-2"><Button disabled={note.trim().length < 3} onClick={() => setConfirm('RESOLVE')}>Đã xử lý</Button>
              <Button variant="outline" disabled={note.trim().length < 3} onClick={() => setConfirm('IGNORE')}>Bỏ qua có lý do</Button></div>}
        </>}
      </div>
    </Dialog>}
  </div>
}

function BankStatements() {
  const { employee, authorization } = useOutletContext<Session>()
  const can = (key: string) => authorization.permissionKeys.includes(key)
  const [page, setPage] = useState(1)
  const [entryPage, setEntryPage] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const [fundId, setFundId] = useState('')
  const [preview, setPreview] = useState<BankInput | null>(null)
  const [fileError, setFileError] = useState('')
  const [ignore, setIgnore] = useState<BankEntry | null>(null)
  const [reason, setReason] = useState('')
  const client = useQueryClient()
  const funds = useQuery({ queryKey: ['private', employee.id, 'bank-funds'],
    queryFn: ({ signal }) => getFunds({ type: 'BANK', itemPerPage: 100 }, signal), enabled: can('/funds_read') })
  const imports = useQuery({ queryKey: ['private', employee.id, 'bank-imports', page],
    queryFn: ({ signal }) => getBankImports(page, signal) })
  const entries = useQuery({ queryKey: ['private', employee.id, 'bank-entries', selectedId, entryPage],
    queryFn: ({ signal }) => getBankEntries(selectedId, entryPage, signal), enabled: Boolean(selectedId) })
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['private', employee.id, 'bank-imports'] })
    void client.invalidateQueries({ queryKey: ['private', employee.id, 'bank-entries'] })
    void client.invalidateQueries({ queryKey: ['management-exceptions-list'] })
  }
  const importing = useMutation({ mutationFn: (input: BankInput) => importBankStatement(input),
    onSuccess: result => { setPreview(null); setSelectedId(result.statementImport.id); setEntryPage(1); refresh() } })
  const reconcile = useMutation({ mutationFn: () => reconcileBank(selectedId), onSuccess: refresh })
  const ignoring = useMutation({ mutationFn: () => ignoreBankEntry(ignore!.id, reason.trim()),
    onSuccess: () => { setIgnore(null); refresh() } })
  async function readFile(file: File) {
    setFileError(''); setPreview(null); importing.reset()
    if (file.size > 256_000) { setFileError('Sao kê vượt giới hạn 256 KB.'); return }
    try {
      const parsed = bankInputSchema.safeParse({ ...JSON.parse(await file.text()), fundId, sourceFileName: file.name })
      if (!parsed.success) { setFileError(parsed.error.issues.map(e => e.path.join('.') + ': ' + e.message).join('; ')); return }
      setPreview(parsed.data)
    } catch { setFileError('Không đọc được sao kê JSON.'); }
  }
  function downloadTemplate() {
    const day = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify({ statementFrom: day + 'T00:00:00Z', statementTo: day + 'T23:59:59Z',
      entries: [{ externalId: 'BANK-001', direction: 'CREDIT', amount: '100000', transactionDate: day + 'T12:00:00Z',
        bankReference: 'DEPOSIT-001', description: 'Nop tien ban giao' }] }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'statement-template.json'; a.click()
    URL.revokeObjectURL(url)
  }
  return <div className="space-y-4">
    {can('/bank-reconciliation_import') && <div className="flex flex-wrap items-end gap-3 border-b pb-4">
      <label className="min-w-0">Quỹ ngân hàng
        {can('/funds_read') ? <select value={fundId} className="block max-w-full rounded border p-2" onChange={e => { setFundId(e.target.value); setPreview(null) }}>
          <option value="">Chọn quỹ</option>{funds.data?.list.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select> :
          <Input value={fundId} onChange={e => { setFundId(e.target.value); setPreview(null) }} />}
      </label>
      <label className="min-w-0">Sao kê JSON<input type="file" accept=".json,application/json" className="block max-w-full"
        disabled={!fundId || importing.isPending} onChange={e => { const file = e.target.files?.[0]; if (file) void readFile(file); e.target.value = '' }} /></label>
      <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4" />Mẫu sao kê</Button>
    </div>}
    {(fileError || importing.isError) && <p role="alert" className="text-destructive">{fileError || errorMessage(importing.error)}</p>}
    {importing.data?.reconciliationPending && <p role="alert" className="text-amber-800">Đã nhập sao kê. Đối soát tự động chưa hoàn tất.</p>}
    {funds.isError && <p role="alert">{errorMessage(funds.error)}</p>}
    {imports.isError ? <p role="alert">{errorMessage(imports.error)}</p> : imports.isPending ? <p role="status">Đang tải...</p> :
      imports.data.list.length === 0 ? <p>Chưa có sao kê.</p> :
      imports.data.list.map(item => <button type="button" key={item.id} aria-pressed={selectedId === item.id}
        className="flex w-full flex-wrap justify-between gap-2 border-b p-3 text-left"
        onClick={() => { setSelectedId(item.id); setEntryPage(1); reconcile.reset() }}>
        <span className="break-all font-medium">{item.sourceFileName}</span><span>{item.fund.name} · {formatDate(item.createdAt)}</span>
      </button>)}
    {imports.data && <Pagination page={page} totalPages={imports.data.totalPages} onPage={setPage} />}
    <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4" />Làm mới</Button>
    {selectedId && <section className="space-y-3 border-t pt-4">
      <h2 className="text-lg font-semibold">Giao dịch sao kê</h2>
      {can('/bank-reconciliation_manage') && <Button variant="outline" disabled={reconcile.isPending} onClick={() => reconcile.mutate()}><RefreshCw className="h-4 w-4" />Đối soát lại sao kê</Button>}
      {reconcile.isError && <p role="alert">{errorMessage(reconcile.error)}</p>}
      {reconcile.isSuccess && <p role="status">Đã đối soát sao kê.</p>}
      {entries.isError ? <p role="alert">{errorMessage(entries.error)}</p> : entries.isPending ? <p role="status">Đang tải...</p> :
        entries.data.list.map(entry => <div className="flex flex-wrap justify-between gap-3 border-b py-3" key={entry.id}>
          <div className="min-w-0"><p className="break-all">{entry.externalId} · {entry.bankReference || '—'}</p><p>{formatVnd(entry.amount)} · {entry.direction} · {entry.matchStatus}</p>
            {entry.mismatchReason && <p className="break-words text-sm">{entry.mismatchReason}</p>}</div>
          {can('/bank-reconciliation_manage') && !['MATCHED', 'IGNORED'].includes(entry.matchStatus) && <Button variant="outline" onClick={() => { setIgnore(entry); setReason(''); ignoring.reset() }}>Bỏ qua</Button>}
        </div>)}
      {entries.data && <Pagination page={entryPage} totalPages={entries.data.totalPages} onPage={setEntryPage} />}
    </section>}
    {preview && <Dialog open maxWidth="xl" onClose={() => { if (!importing.isPending) setPreview(null) }}>
      <div className="space-y-4 p-5"><h2 className="pr-8 text-lg font-semibold">Xác nhận nhập sao kê</h2>
        <p>{preview.sourceFileName} · {preview.entries.length} giao dịch</p>
        <div className="max-h-72 overflow-auto"><table className="w-full min-w-[480px] text-sm"><thead><tr><th>Mã</th><th>Chiều</th><th>Số tiền</th><th>Ngày</th></tr></thead>
          <tbody>{preview.entries.map(entry => <tr key={entry.externalId}><td>{entry.externalId}</td><td>{entry.direction}</td><td>{formatVnd(entry.amount)}</td><td>{formatDate(entry.transactionDate)}</td></tr>)}</tbody></table></div>
        {importing.isError && <p role="alert">{errorMessage(importing.error)} Kiểm tra lịch sử nhập trước khi gửi lại.</p>}
        <Button disabled={importing.isPending} onClick={() => importing.mutate(preview)}><Upload className="h-4 w-4" />Xác nhận nhập</Button>
      </div>
    </Dialog>}
    {ignore && <Dialog open onClose={() => { if (!ignoring.isPending) setIgnore(null) }}>
      <form className="space-y-4 p-5" onSubmit={e => { e.preventDefault(); ignoring.mutate() }}>
        <h2 className="pr-8 text-lg font-semibold">Bỏ qua giao dịch {ignore.externalId}</h2>
        <label>Lý do<Input value={reason} maxLength={500} required onChange={e => setReason(e.target.value)} /></label>
        {ignoring.isError && <p role="alert">{errorMessage(ignoring.error)}</p>}
        <Button disabled={ignoring.isPending || !reason.trim()} type="submit"><CheckCircle2 className="h-4 w-4" />Xác nhận bỏ qua</Button>
      </form>
    </Dialog>}
  </div>
}

const feedbackSchema = z.object({ id: z.string(), invoice: z.object({ invoiceNumber: z.string() }), rating: z.number(), comment: z.string().nullable(), createdAt: z.string() })
function FeedbackCases() {
  const { employee, authorization } = useOutletContext<Session>()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<z.infer<typeof feedbackSchema> | null>(null)
  const [note, setNote] = useState('')
  const query = useQuery({ queryKey: ['private', employee.id, 'feedback-cases', page],
    queryFn: ({ signal }) => apiGet('/orders/takeaway/feedback/cases?page=' + page + '&itemPerPage=20', paginatedResponseSchema(feedbackSchema), signal, true) })
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: () => resolveFeedback(selected!.id, note.trim()),
    onSuccess: () => { setSelected(null); void query.refetch(); void client.invalidateQueries({ queryKey: ['management-exceptions-list'] }); void client.invalidateQueries({ queryKey: ['management-exceptions-summary'] }) } })
  return <div className="space-y-3">
    {query.isError ? <p role="alert">{errorMessage(query.error)}</p> : query.isPending ? <p role="status">Đang tải...</p> :
      query.data.list.length === 0 ? <p>Không có khiếu nại chưa xử lý.</p> : query.data.list.map(item => <div key={item.id} className="flex justify-between gap-3 border-b py-3">
        <div className="min-w-0"><p>{item.rating} sao · {formatDate(item.createdAt)}</p><p className="break-words">{item.comment}</p><p className="break-all text-sm">{item.invoice.invoiceNumber}</p></div>
        {authorization.permissionKeys.includes('/feedback_resolve') && <Button variant="outline" onClick={() => { setSelected(item); setNote(''); mutation.reset() }}>Xử lý</Button>}
      </div>)}
    <Button variant="outline" onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" />Làm mới</Button>
    {query.data && <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} />}
    {selected && <Dialog open onClose={() => { if (!mutation.isPending) setSelected(null) }}>
      <form className="space-y-4 p-5" onSubmit={e => { e.preventDefault(); mutation.mutate() }}>
        <h2 className="pr-8 text-lg font-semibold">Xác nhận xử lý khiếu nại</h2><p>{selected.comment}</p>
        <label>Kết quả xử lý<Input required maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
        {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
        <Button type="submit" disabled={!note.trim() || mutation.isPending}><CheckCircle2 className="h-4 w-4" />Xác nhận đã xử lý</Button>
      </form>
    </Dialog>}
  </div>
}
