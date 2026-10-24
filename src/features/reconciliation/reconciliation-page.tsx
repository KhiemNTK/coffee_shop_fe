import { useOutletContext, useSearchParams } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import type { Session } from '../auth/session'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui'
import { PaymentIncidentsTab } from './components/payment-incidents-tab'
import { BankStatementsTab } from './components/bank-statements-tab'
import { FeedbackCasesTab } from './components/feedback-cases-tab'

export default function ReconciliationPage() {
  const session = useOutletContext<Session>()
  const can = session.access.has
  const [params, setParams] = useSearchParams()

  const tabs = [
    can('/payment-reconciliation_read') && 'payments',
    can('/bank-reconciliation_read') && 'bank',
    can('/reports_read') && 'feedback',
  ].filter(Boolean) as string[]

  const currentTab = tabs.includes(params.get('tab') || '') ? params.get('tab')! : (tabs[0] ?? '')

  const handleTabChange = (value: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (value === 'payments') next.delete('tab')
      else next.set('tab', value)
      return next
    })
  }

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Đối soát &amp; Khiếu nại
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Quản lý các sự cố thanh toán, chênh lệch doanh thu và phản hồi từ khách hàng
            </p>
          </div>
        </div>
      </div>

      {/* Module Tabs Navigation */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-5">
        <div className="border-b border-border/70 pb-3">
          <TabsList className="h-10 p-1 bg-muted/60 rounded-xl border border-border/60 gap-1">
            {tabs.includes('payments') && (
              <TabsTrigger
                value="payments"
                className="rounded-lg px-4 py-1.5 text-xs font-semibold data-[state=active]:bg-[#062F29] data-[state=active]:text-white shadow-xs transition-all"
              >
                Sự cố thanh toán
              </TabsTrigger>
            )}
            {tabs.includes('bank') && (
              <TabsTrigger
                value="bank"
                className="rounded-lg px-4 py-1.5 text-xs font-semibold data-[state=active]:bg-[#062F29] data-[state=active]:text-white shadow-xs transition-all"
              >
                Sao kê ngân hàng
              </TabsTrigger>
            )}
            {tabs.includes('feedback') && (
              <TabsTrigger
                value="feedback"
                className="rounded-lg px-4 py-1.5 text-xs font-semibold data-[state=active]:bg-[#062F29] data-[state=active]:text-white shadow-xs transition-all"
              >
                Phản hồi khách
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {tabs.includes('payments') && (
          <TabsContent value="payments" className="focus-visible:outline-hidden space-y-4">
            <PaymentIncidentsTab />
          </TabsContent>
        )}
        {tabs.includes('bank') && (
          <TabsContent value="bank" className="focus-visible:outline-hidden space-y-4">
            <BankStatementsTab />
          </TabsContent>
        )}
        {tabs.includes('feedback') && (
          <TabsContent value="feedback" className="focus-visible:outline-hidden space-y-4">
            <FeedbackCasesTab />
          </TabsContent>
        )}
      </Tabs>
    </section>
  )
}
