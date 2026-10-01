import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import {
  AlertCircle,
  Coffee,
  Plus,
  ShoppingBag,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { errorMessage } from '../../shared/api/client'
import { type Session } from '../auth/session'
import { getCurrentShift } from '../cashier-shifts/cashier-shifts.api'
import {
  getDiningTables,
  getActiveSessions,
  openOrderSession,
  type DiningTable,
} from './pos.api'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Badge } from '../../shared/ui/badge'
import { Input } from '../../shared/ui/input'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../shared/ui/dialog'
import { cn } from '../../shared/ui/utils'

export default function PosTablesPage() {
  const { employee, authorization } = useOutletContext<Session>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [openingTableId, setOpeningTableId] = useState<string | null>(null)
  const [guestCount, setGuestCount] = useState<number>(2)
  const [actionError, setActionError] = useState<string | null>(null)

  const canCreateSession = authorization.permissionKeys.includes(
    '/orders_sessions_create',
  )

  const shiftQuery = useQuery({
    queryKey: ['private', employee.id, 'cashier-shift', 'current'],
    queryFn: ({ signal }) => getCurrentShift(signal),
  })

  const tablesQuery = useQuery({
    queryKey: ['private', employee.id, 'dining-tables'],
    queryFn: ({ signal }) => getDiningTables(signal),
  })

  const sessionsQuery = useQuery({
    queryKey: ['private', employee.id, 'orders', 'active-sessions'],
    queryFn: ({ signal }) => getActiveSessions(signal),
    refetchInterval: 10_000,
  })

  const openSessionMutation = useMutation({
    mutationFn: async (tableId: string | null) => {
      setActionError(null)
      return openOrderSession(tableId, tableId ? guestCount : undefined)
    },
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'dining-tables'] })
      void queryClient.invalidateQueries({
        queryKey: ['private', employee.id, 'orders', 'active-sessions'],
      })
      navigate(`/staff/pos/sessions/${session.id}`)
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  if (tablesQuery.isPending || sessionsQuery.isPending || shiftQuery.isPending) {
    return (
      <main className="flex min-h-[300px] items-center justify-center p-8 text-muted-foreground" role="status">
        <p className="animate-pulse">Đang tải sơ đồ bàn…</p>
      </main>
    )
  }

  if (tablesQuery.isError) {
    return (
      <main className="mx-auto my-12 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-destructive font-semibold" role="alert">{errorMessage(tablesQuery.error)}</p>
        <Button
          onClick={() => void tablesQuery.refetch()}
          disabled={tablesQuery.isFetching}
          className="mt-4"
        >
          Thử lại
        </Button>
      </main>
    )
  }

  const tables = tablesQuery.data || []
  const activeSessions = sessionsQuery.data || []
  const currentShift = shiftQuery.data

  const emptyCount = tables.filter((t) => t.status === 'EMPTY').length
  const occupiedCount = tables.filter((t) => t.status === 'OCCUPIED').length
  const takeawaySessions = activeSessions.filter((s) => s.table === null)

  const sessionByTableId = new Map<string, (typeof activeSessions)[0]>()
  for (const s of activeSessions) {
    if (s.table?.id) {
      sessionByTableId.set(s.table.id, s)
    }
  }

  function handleTableClick(table: DiningTable) {
    const existing = sessionByTableId.get(table.id)
    if (existing) {
      navigate(`/staff/pos/sessions/${existing.id}`)
      return
    }
    if (!canCreateSession) {
      setActionError('Bạn không có quyền mở phiên bàn mới (/orders_sessions_create).')
      return
    }
    setOpeningTableId(table.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BÁN HÀNG</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sơ đồ bàn & Bán lẻ (POS)</h1>
        </div>

        {canCreateSession && (
          <Button
            type="button"
            onClick={() => openSessionMutation.mutate(null)}
            isLoading={openSessionMutation.isPending}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <ShoppingBag className="h-4 w-4" />
            Mở đơn mang đi
          </Button>
        )}
      </div>

      {!currentShift && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <span className="text-sm">
              <strong>Lưu ý:</strong> Bạn chưa mở ca thu ngân. Vui lòng mở ca trước khi chốt hóa đơn.
            </span>
          </div>
          <Link
            to="/staff/shifts"
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors shrink-0"
          >
            Mở ca ngay
          </Link>
        </div>
      )}

      {actionError && (
        <div
          className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bàn trống
            </span>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {emptyCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Đang có khách
            </span>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {occupiedCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Đơn mang đi
            </span>
            <p className="mt-1 text-2xl font-bold text-primary">
              {takeawaySessions.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modal xác nhận số lượng khách khi mở bàn */}
      <Dialog
        open={Boolean(openingTableId)}
        onOpenChange={(open) => {
          if (!open) setOpeningTableId(null)
        }}
        maxWidth="sm"
      >
        <DialogHeader>
          <DialogTitle>Mở bàn phục vụ</DialogTitle>
          <DialogDescription>
            Bàn: <strong className="text-foreground">{tables.find((t) => t.id === openingTableId)?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2">
          <label htmlFor="guestCountInput" className="block text-sm font-semibold text-foreground">
            Số lượng khách
          </label>
          <Input
            id="guestCountInput"
            type="number"
            min="1"
            max="50"
            value={guestCount}
            onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpeningTableId(null)}
            className="flex-1"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => {
              const id = openingTableId
              setOpeningTableId(null)
              openSessionMutation.mutate(id)
            }}
            isLoading={openSessionMutation.isPending}
            className="flex-2"
          >
            Xác nhận mở bàn
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Lưới sơ đồ bàn */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <UtensilsCrossed className="h-5 w-5 text-primary" /> Danh sách bàn tại quán
        </h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tables.map((table) => {
            const session = sessionByTableId.get(table.id)
            const isOccupied = table.status === 'OCCUPIED' || Boolean(session)
            return (
              <div
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={cn(
                  'flex min-h-[120px] cursor-pointer flex-col justify-between rounded-xl border-2 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md select-none',
                  isOccupied
                    ? 'border-amber-400 bg-amber-50/30 hover:border-amber-500'
                    : 'border-emerald-500/50 bg-card hover:border-emerald-600',
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-base font-bold text-foreground">{table.name}</span>
                  <Badge variant={isOccupied ? 'warning' : 'success'} className="text-[11px]">
                    {isOccupied ? 'Có khách' : 'Trống'}
                  </Badge>
                </div>

                {session ? (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-foreground/70" />
                      <span>{session.guestCount ?? 1} khách</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Coffee className="h-3.5 w-3.5 text-foreground/70" />
                      <span>{session._count.orderItems} món</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <Plus className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Mở bàn</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Danh sách đơn mang đi (Takeaway) */}
      {takeawaySessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ShoppingBag className="h-4 w-4 text-primary" /> Đơn mang đi đang phục vụ ({takeawaySessions.length})
            </CardTitle>
            <CardDescription>
              Các phiên gọi món mang đi chưa thanh toán
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {takeawaySessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => navigate(`/staff/pos/sessions/${session.id}`)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3.5 transition-colors hover:bg-muted/70 hover:border-primary/50"
                >
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Đơn mang đi #{session.id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session._count.orderItems} món • {session.employee?.fullName ?? 'Nhân viên'}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary">
                    Mở đơn &rarr;
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
