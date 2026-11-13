import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Coins,
  History,
  Lock,
  PlusCircle,
  Send,
  Wallet,
  X,
} from 'lucide-react'
import { type Session } from '../auth/session'
import { getCurrentShift } from './cashier-shifts.api'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, cn } from '../../shared/ui'
import { CurrentShiftTab } from './components/current-shift-tab'
import { CashHandoversTab } from './components/cash-handovers-tab'
import { ExpenseRequestsTab } from './components/expense-requests-tab'
import { FundsTab } from './components/funds-tab'
import { ShiftHistoryTab } from './components/shift-history-tab'

type MainTab = 'current' | 'handovers' | 'expenses' | 'funds' | 'history'

export default function CashierShiftPage() {
  const { t } = useTranslation()
  const { employee, access } = useOutletContext<Session>()

  // Permissions
  const canReadCurrent = access.has(
    '/cashier-shifts_current',
  )
  const canOpen = access.has('/cashier-shifts_open')
  const canClose = access.has(
    '/cashier-shifts_close',
  )
  const canTransact = access.has(
    '/cashier-shifts_transactions-create',
  )
  const canReadShifts = access.has(
    '/cashier-shifts_read',
  )
  const canReviewExpenses = access.has(
    '/cashier-shifts_expenses-review',
  )
  const canCreateHandover = access.has(
    '/cash-handovers_create',
  )
  const canReadHandovers = access.has(
    '/cash-handovers_read',
  )
  const canReviewHandover = access.has(
    '/cash-handovers_review',
  )
  const canSettleHandover = access.has(
    '/cash-handovers_settle',
  )
  const canReadFunds = access.has('/funds_read')
  const canManageFunds =
    canReadFunds && access.has('/funds_manage')

  const [params, setParams] = useSearchParams()
  const availableTabs: MainTab[] = []
  if (canReadCurrent) availableTabs.push('current')
  if (canReadShifts) availableTabs.push('history')
  if (canReadHandovers || canCreateHandover) availableTabs.push('handovers')
  if (canReviewExpenses) availableTabs.push('expenses')
  if (canReadFunds) availableTabs.push('funds')
  const activeTab = availableTabs.find(tab => tab === params.get('tab')) ?? availableTabs[0]
  function setActiveTab(tab: MainTab) {
    setParams(previous => {
      const next = new URLSearchParams(previous)
      next.set('tab', tab)
      return next
    })
  }

  // Feedback notifications
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (actionError) errorRef.current?.focus()
  }, [actionError])

  const clearFeedback = () => {
    setActionError(null)
    setActionSuccess(null)
  }

  // Coordinated global modal states
  const [isCreateHandoverModalOpen, setIsCreateHandoverModalOpen] =
    useState(false)
  const [createHandoverShiftId, setCreateHandoverShiftId] = useState('')
  const [isCreateFundModalOpen, setIsCreateFundModalOpen] = useState(false)

  // Current shift query for header indicator
  const currentShiftQuery = useQuery({
    queryKey: ['private', employee.id, 'cashier-shift', 'current'],
    queryFn: ({ signal }) => getCurrentShift(signal),
    enabled: canReadCurrent,
  })

  return (
    <Tabs value={activeTab ?? ''} onValueChange={value => setActiveTab(value as MainTab)} className="flex min-w-0 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('cash.page.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('cash.page.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Quick Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canCreateHandover && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateHandoverShiftId('')
                setIsCreateHandoverModalOpen(true)
                setActiveTab('handovers')
              }}
              className="gap-2"
            >
              <Send className="w-4 h-4 text-emerald-500" />
              {t('cash.page.createHandover')}
            </Button>
          )}
          {canManageFunds && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setIsCreateFundModalOpen(true)
                setActiveTab('funds')
              }}
              className="gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              {t('cash.page.createFund')}
            </Button>
          )}
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {actionError && (
        <div ref={errorRef} role="alert" tabIndex={-1} className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1 font-medium">{actionError}</div>
          <Button variant="ghost" size="icon" onClick={clearFeedback} aria-label={t('common.close')} title={t('common.close')}>
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {actionSuccess && (
        <div role="status" className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="flex-1 font-medium">{actionSuccess}</div>
          <Button variant="ghost" size="icon" onClick={clearFeedback} aria-label={t('common.close')} title={t('common.close')}>
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* TABS NAVIGATION */}
      {availableTabs.length > 0 && <TabsList aria-label={t('cash.page.title')} className="flex w-full flex-nowrap justify-start gap-2 overflow-x-auto rounded-none border-b border-border bg-transparent p-1">
        {([
          { value: 'current', label: t('cash.page.current'), icon: Lock },
          { value: 'handovers', label: t('cash.page.handovers'), icon: Send },
          { value: 'expenses', label: t('cash.page.expenses'), icon: Wallet },
          { value: 'funds', label: t('cash.page.funds'), icon: Building2 },
          { value: 'history', label: t('cash.page.history'), icon: History },
        ] as const).filter(tab => availableTabs.includes(tab.value)).map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className={cn('shrink-0 gap-2 border-b-2 py-2.5 dark:hover:bg-muted', activeTab === value ? 'border-primary dark:bg-primary/15 dark:text-foreground' : 'border-transparent dark:text-muted-foreground')}>
            <Icon className="w-4 h-4" aria-hidden="true" />
            {label}
            {value === 'current' && currentShiftQuery.data?.status === 'OPEN' && <><span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" /><span className="sr-only">{t('cash.shiftOpen')}</span></>}
          </TabsTrigger>
        ))}
      </TabsList>}

      {!availableTabs.length && <p role="alert">{t('cash.page.accessRequired')}</p>}

      {/* ACTIVE TAB CONTENT */}
      {canReadCurrent && <TabsContent value="current" className="mt-0">
        <CurrentShiftTab
          employeeId={employee.id}
          canOpen={canOpen && canReadFunds}
          canClose={canClose}
          canTransact={canTransact}
          canCreateHandover={canCreateHandover}
          onOpenCreateHandover={(shiftId) => {
            if (shiftId) setCreateHandoverShiftId(shiftId)
            setIsCreateHandoverModalOpen(true)
            setActiveTab('handovers')
          }}
          onError={(msg) => {
            clearFeedback()
            setActionError(msg)
          }}
          onSuccess={(msg) => {
            clearFeedback()
            setActionSuccess(msg)
          }}
        />
      </TabsContent>}

      {(canReadHandovers || canCreateHandover) && <TabsContent value="handovers" className="mt-0">
        <CashHandoversTab
          employeeId={employee.id}
          canCreateHandover={canCreateHandover}
          canReadHandovers={canReadHandovers}
          canReadFunds={canReadFunds}
          canReviewHandover={canReviewHandover}
          canSettleHandover={canSettleHandover}
          isCreateModalOpen={isCreateHandoverModalOpen}
          setIsCreateModalOpen={setIsCreateHandoverModalOpen}
          createHandoverShiftId={createHandoverShiftId}
          setCreateHandoverShiftId={setCreateHandoverShiftId}
          onError={(msg) => {
            clearFeedback()
            setActionError(msg)
          }}
          onSuccess={(msg) => {
            clearFeedback()
            setActionSuccess(msg)
          }}
        />
      </TabsContent>}

      {canReviewExpenses && <TabsContent value="expenses" className="mt-0">
        <ExpenseRequestsTab
          onError={(msg) => {
            clearFeedback()
            setActionError(msg)
          }}
          onSuccess={(msg) => {
            clearFeedback()
            setActionSuccess(msg)
          }}
        />
      </TabsContent>}

      {canReadFunds && <TabsContent value="funds" className="mt-0">
        <FundsTab
          canManageFunds={canManageFunds}
          isCreateModalOpen={isCreateFundModalOpen}
          setIsCreateModalOpen={setIsCreateFundModalOpen}
          onError={(msg) => {
            clearFeedback()
            setActionError(msg)
          }}
          onSuccess={(msg) => {
            clearFeedback()
            setActionSuccess(msg)
          }}
        />
      </TabsContent>}

      {canReadShifts && <TabsContent value="history" className="mt-0"><ShiftHistoryTab /></TabsContent>}
    </Tabs>
  )
}
