import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
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
import { Button, cn } from '../../shared/ui'
import { CurrentShiftTab } from './components/current-shift-tab'
import { CashHandoversTab } from './components/cash-handovers-tab'
import { ExpenseRequestsTab } from './components/expense-requests-tab'
import { FundsTab } from './components/funds-tab'
import { ShiftHistoryTab } from './components/shift-history-tab'

type MainTab = 'current' | 'handovers' | 'expenses' | 'funds' | 'history'

export default function CashierShiftPage() {
  const { employee, authorization } = useOutletContext<Session>()

  // Permissions
  const canReadCurrent = authorization.permissionKeys.includes(
    '/cashier-shifts_current',
  )
  const canOpen = authorization.permissionKeys.includes('/cashier-shifts_open')
  const canClose = authorization.permissionKeys.includes(
    '/cashier-shifts_close',
  )
  const canTransact = authorization.permissionKeys.includes(
    '/cashier-shifts_transactions-create',
  )
  const canReadShifts = authorization.permissionKeys.includes(
    '/cashier-shifts_read',
  )
  const canReviewExpenses = authorization.permissionKeys.includes(
    '/cashier-shifts_expenses-review',
  )
  const canCreateHandover = authorization.permissionKeys.includes(
    '/cash-handovers_create',
  )
  const canReadHandovers = authorization.permissionKeys.includes(
    '/cash-handovers_read',
  )
  const canReviewHandover = authorization.permissionKeys.includes(
    '/cash-handovers_review',
  )
  const canSettleHandover = authorization.permissionKeys.includes(
    '/cash-handovers_settle',
  )
  const canReadFunds = authorization.permissionKeys.includes('/funds_read')
  const canManageFunds =
    canReadFunds && authorization.permissionKeys.includes('/funds_manage')

  // Tabs state
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'expenses' && canReviewExpenses) return 'expenses'
    if (tab === 'handovers' && canReadHandovers) return 'handovers'
    if (canReadCurrent) return 'current'
    if (canReadShifts) return 'history'
    if (canReadHandovers || canCreateHandover) return 'handovers'
    if (canReviewExpenses) return 'expenses'
    return 'funds'
  })

  // Stable timestamp for pure renders
  const [nowTimestamp] = useState(() => Date.now())

  // Feedback notifications
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

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
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Quản lý Ca & Quỹ tiền mặt
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Vận hành két thu ngân, lập biên bản bàn giao, duyệt phiếu chi và
                kiểm soát số dư két an toàn
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Quick Buttons */}
        <div className="flex items-center gap-2">
          {canCreateHandover && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (currentShiftQuery.data?.id) {
                  setCreateHandoverShiftId(currentShiftQuery.data.id)
                }
                setIsCreateHandoverModalOpen(true)
                setActiveTab('handovers')
              }}
              className="gap-2"
            >
              <Send className="w-4 h-4 text-emerald-500" />
              Lập biên bản bàn giao
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
              Thêm quỹ mới
            </Button>
          )}
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {actionError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1 font-medium">{actionError}</div>
          <button onClick={clearFeedback} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="flex-1 font-medium">{actionSuccess}</div>
          <button onClick={clearFeedback} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-px">
        {canReadCurrent && (
          <button
            onClick={() => setActiveTab('current')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === 'current'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Lock className="w-4 h-4" />
            Ca làm việc của tôi
            {currentShiftQuery.data?.status === 'OPEN' && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        )}

        {(canReadHandovers || canCreateHandover) && (
          <button
            onClick={() => setActiveTab('handovers')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === 'handovers'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Send className="w-4 h-4" />
            Bàn giao két & Nộp tiền
          </button>
        )}

        {canReviewExpenses && (
          <button
            onClick={() => setActiveTab('expenses')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === 'expenses'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Wallet className="w-4 h-4" />
            Duyệt phiếu chi tiền
          </button>
        )}

        {canReadFunds && (
          <button
            onClick={() => setActiveTab('funds')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === 'funds'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Building2 className="w-4 h-4" />
            Danh mục Quỹ két
          </button>
        )}

        {canReadShifts && (
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <History className="w-4 h-4" />
            Lịch sử ca thu ngân
          </button>
        )}
      </div>

      {/* ACTIVE TAB CONTENT */}
      {activeTab === 'current' && canReadCurrent && (
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
      )}

      {activeTab === 'handovers' && (canReadHandovers || canCreateHandover) && (
        <CashHandoversTab
          employeeId={employee.id}
          canCreateHandover={canCreateHandover}
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
          nowTimestamp={nowTimestamp}
        />
      )}

      {activeTab === 'expenses' && canReviewExpenses && (
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
      )}

      {activeTab === 'funds' && canReadFunds && (
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
      )}

      {activeTab === 'history' && canReadShifts && <ShiftHistoryTab />}
    </div>
  )
}
