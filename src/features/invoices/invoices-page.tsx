import { useState, useMemo, useDeferredValue } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '../auth/session'
import { Receipt, RefreshCw } from 'lucide-react'
import {
  getInvoices,
  type InvoicesFilters,
  type Invoice,
} from './invoices.api'
import { Button, cn } from '../../shared/ui'
import { InvoicesKpis } from './components/invoices-kpis'
import { InvoicesListTable } from './components/invoices-list-table'
import { InvoiceDetailDialog } from './components/invoice-detail-dialog'

const EMPTY_INVOICES: Invoice[] = []

export default function InvoicesPage() {
  const { employee } = useOutletContext<Session>()
  const queryClient = useQueryClient()

  // Filters state
  const [filters, setFilters] = useState<InvoicesFilters>({
    page: 1,
    itemPerPage: 15,
    paymentStatus: '',
    paymentMethod: '',
  })
  const [searchKeyword, setSearchKeyword] = useState('')
  const deferredSearchKeyword = useDeferredValue(searchKeyword)

  // Detail Modal state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  // Query Invoices
  const invoicesQuery = useQuery({
    queryKey: ['private', employee.id, 'invoices', filters],
    queryFn: ({ signal }) => getInvoices(filters, signal),
  })

  // Quick statistics calculation from current page/data
  const invoices = invoicesQuery.data?.list ?? EMPTY_INVOICES
  const totalPaidAmount = invoices
    .filter((inv) => inv.paymentStatus === 'PAID')
    .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)
  const unpaidCount = invoices.filter((inv) => inv.paymentStatus === 'UNPAID').length
  const voidedCount = invoices.filter((inv) => inv.paymentStatus === 'VOIDED').length

  // Filtered by client search keyword if provided
  const displayList = useMemo(() => {
    if (!deferredSearchKeyword.trim()) return invoices
    const kw = deferredSearchKeyword.trim().toLowerCase()
    return invoices.filter((inv) => (
      inv.invoiceNumber.toLowerCase().includes(kw) ||
      inv.orderSession?.table?.name.toLowerCase().includes(kw) ||
      inv.employee?.fullName.toLowerCase().includes(kw)
    ))
  }, [invoices, deferredSearchKeyword])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-800 text-white flex items-center justify-center shadow-xs">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Quản lý Hóa đơn & Thanh toán
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Theo dõi lịch sử hóa đơn bán hàng, cổng thanh toán VNPay, MoMo và đối soát giao dịch
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void invoicesQuery.refetch()}
            disabled={invoicesQuery.isFetching}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', invoicesQuery.isFetching && 'animate-spin')} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <InvoicesKpis
        totalPaidAmount={totalPaidAmount}
        totalItems={invoicesQuery.data?.totalItems ?? 0}
        unpaidCount={unpaidCount}
        voidedCount={voidedCount}
      />

      {/* Main Table and Filters */}
      <InvoicesListTable
        filters={filters}
        setFilters={setFilters}
        searchKeyword={searchKeyword}
        setSearchKeyword={setSearchKeyword}
        displayList={displayList}
        data={invoicesQuery.data}
        isLoading={invoicesQuery.isLoading}
        isError={invoicesQuery.isError}
        error={invoicesQuery.error}
        isFetching={invoicesQuery.isFetching}
        onRefetch={() => void invoicesQuery.refetch()}
        onSelectInvoice={(id) => setSelectedInvoiceId(id)}
      />

      {/* Invoice Detail & Payment Gateway Modal */}
      {selectedInvoiceId && (
        <InvoiceDetailDialog
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onUpdated={() => {
            void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'invoices'] })
          }}
        />
      )}
    </div>
  )
}
