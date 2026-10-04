import { useState, useMemo, useDeferredValue } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Cpu,
  Search,
  RefreshCw,
  Edit2,
  History,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Ban,
} from 'lucide-react'
import {
  settingsApi,
  type EquipmentItem,
  type EquipmentStatus,
  type CreateEquipmentInput,
  type UpdateEquipmentInput,
  type TransitionEquipmentInput,
} from '@/features/settings/settings.api'
import { errorMessage } from '@/shared/api/client'
import { formatVnd, formatDate } from '@/shared/lib/format'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

const ALLOWED_EQUIPMENT_TRANSITIONS: Record<EquipmentStatus, EquipmentStatus[]> = {
  IN_USE: ['MAINTENANCE', 'BROKEN', 'LIQUIDATED'],
  MAINTENANCE: ['IN_USE', 'BROKEN', 'LIQUIDATED'],
  BROKEN: ['MAINTENANCE', 'LIQUIDATED'],
  LIQUIDATED: [],
}

export interface EquipmentTabProps {
  canCreate: boolean
  canUpdate: boolean
  canTransition: boolean
  onToast: (msg: string) => void
  isCreateOpen: boolean
  setIsCreateOpen: (open: boolean) => void
}

export function EquipmentTab({
  canUpdate,
  canTransition,
  onToast,
  isCreateOpen,
  setIsCreateOpen,
}: EquipmentTabProps) {
  const queryClient = useQueryClient()

  // Search & Filter
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const deferredEquipmentSearch = useDeferredValue(equipmentSearch)
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState<'ALL' | EquipmentStatus>('ALL')

  // Modals state
  const [createEquipmentData, setCreateEquipmentData] = useState<CreateEquipmentInput>(() => ({
    assetCode: '',
    name: '',
    quantity: 1,
    unitPrice: '0',
    purchaseDate: new Date().toISOString().split('T')[0]!,
    location: '',
    notes: '',
  }))
  const [createEquipmentError, setCreateEquipmentError] = useState<string | null>(null)

  const [editingEquipment, setEditingEquipment] = useState<EquipmentItem | null>(null)
  const [editEquipmentData, setEditEquipmentData] = useState<UpdateEquipmentInput>({})
  const [editEquipmentError, setEditEquipmentError] = useState<string | null>(null)

  const [transitioningEquipment, setTransitioningEquipment] = useState<EquipmentItem | null>(null)
  const [transitionData, setTransitionData] = useState<TransitionEquipmentInput>({
    status: 'MAINTENANCE',
    reason: '',
    cost: '0',
  })
  const [transitionError, setTransitionError] = useState<string | null>(null)

  const [viewingEventsEquipment, setViewingEventsEquipment] = useState<EquipmentItem | null>(null)

  // Queries
  const {
    data: equipmentData,
    isLoading: isLoadingEquipment,
  } = useQuery({
    queryKey: ['equipment-list', deferredEquipmentSearch, equipmentStatusFilter],
    queryFn: ({ signal }) =>
      settingsApi.getEquipment(
        {
          keyword: deferredEquipmentSearch.trim() || undefined,
          status: equipmentStatusFilter === 'ALL' ? undefined : equipmentStatusFilter,
          itemPerPage: 50,
        },
        signal,
      ),
  })

  const {
    data: equipmentEventsData,
    isLoading: isLoadingEvents,
  } = useQuery({
    queryKey: ['equipment-events', viewingEventsEquipment?.id],
    queryFn: ({ signal }) =>
      viewingEventsEquipment
        ? settingsApi.getEquipmentEvents(viewingEventsEquipment.id, undefined, signal)
        : null,
    enabled: !!viewingEventsEquipment,
  })

  const invalidateEquipment = () => {
    void queryClient.invalidateQueries({ queryKey: ['equipment-list'] })
  }

  // Mutations
  const createEquipmentMutation = useMutation({
    mutationFn: (data: CreateEquipmentInput) => settingsApi.createEquipment(data),
    onSuccess: (item) => {
      invalidateEquipment()
      onToast(`Đã thêm thiết bị "${item.name}" thành công`)
      setIsCreateOpen(false)
      setCreateEquipmentData({
        assetCode: '',
        name: '',
        quantity: 1,
        unitPrice: '0',
        purchaseDate: new Date().toISOString().split('T')[0]!,
        location: '',
        notes: '',
      })
      setCreateEquipmentError(null)
    },
    onError: (err) => setCreateEquipmentError(errorMessage(err)),
  })

  const updateEquipmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEquipmentInput }) =>
      settingsApi.updateEquipment(id, data),
    onSuccess: (item) => {
      invalidateEquipment()
      onToast(`Đã cập nhật thông tin thiết bị "${item.name}"`)
      setEditingEquipment(null)
      setEditEquipmentError(null)
    },
    onError: (err) => setEditEquipmentError(errorMessage(err)),
  })

  const transitionEquipmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransitionEquipmentInput }) =>
      settingsApi.transitionEquipment(id, data),
    onSuccess: (res) => {
      invalidateEquipment()
      onToast(`Đã chuyển trạng thái thiết bị "${res.equipment.name}" thành công`)
      setTransitioningEquipment(null)
      setTransitionError(null)
    },
    onError: (err) => setTransitionError(errorMessage(err)),
  })

  // Computed KPI Metrics
  const equipmentStats = useMemo(() => {
    const list = equipmentData?.list || []
    return {
      total: equipmentData?.totalItems ?? list.length,
      inUse: list.filter((e) => e.status === 'IN_USE').length,
      maintenance: list.filter((e) => e.status === 'MAINTENANCE').length,
      brokenOrLiquidated: list.filter(
        (e) => e.status === 'BROKEN' || e.status === 'LIQUIDATED',
      ).length,
    }
  }, [equipmentData])

  return (
    <div className="space-y-4">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tổng thiết bị</span>
              <Cpu className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {equipmentStats.total}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">tài sản quán</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Đang hoạt động</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {equipmentStats.inUse}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">vận hành tốt</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Đang bảo trì</span>
              <Wrench className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400">
              {equipmentStats.maintenance}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">cần bảo dưỡng</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Hỏng / Thanh lý</span>
              <Ban className="h-4 w-4 text-destructive" />
            </div>
            <div className="mt-2 text-2xl font-bold text-destructive">
              {equipmentStats.brokenOrLiquidated}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">ngừng sử dụng</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border border-border/80 p-3 shadow-xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên thiết bị, mã tài sản, serial number..."
              value={equipmentSearch}
              onChange={(e) => setEquipmentSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc theo trạng thái thiết bị"
              value={equipmentStatusFilter}
              onChange={(e) => setEquipmentStatusFilter(e.target.value as any)}
              className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="IN_USE">Đang sử dụng (Hoạt động)</option>
              <option value="MAINTENANCE">Đang bảo trì / Sửa chữa</option>
              <option value="BROKEN">Hỏng hóc</option>
              <option value="LIQUIDATED">Đã thanh lý</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Equipment Table */}
      {isLoadingEquipment ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="mt-3 text-sm">Đang tải danh sách trang thiết bị...</p>
        </div>
      ) : !equipmentData?.list || equipmentData.list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <Cpu className="h-10 w-10 text-muted-foreground mb-2" />
          <h3 className="text-base font-semibold text-foreground">Không tìm thấy thiết bị nào</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Chưa có thiết bị nào phù hợp với bộ lọc hoặc hệ thống chưa ghi nhận tài sản máy móc.
          </p>
        </div>
      ) : (
        <Card className="border border-border/80 overflow-hidden shadow-xs">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Mã & Tên Thiết bị</th>
                  <th className="px-4 py-3">Vị trí & SL</th>
                  <th className="px-4 py-3">Đơn giá / Tổng</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Lịch bảo trì</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {equipmentData.list.map((item) => {
                  const isMaintenance = item.status === 'MAINTENANCE'
                  const isBroken = item.status === 'BROKEN'
                  const isLiquidated = item.status === 'LIQUIDATED'

                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div>
                          <div className="font-semibold text-foreground">{item.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-mono">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
                              {item.assetCode}
                            </span>
                            {item.serialNumber && <span>SN: {item.serialNumber}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">
                          {item.location || 'Chưa định vị'}
                        </div>
                        <div>SL: {item.quantity} cái</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-semibold text-foreground">
                          {formatVnd(item.totalAmount)}
                        </div>
                        <div className="text-muted-foreground">
                          Đơn giá: {formatVnd(item.unitPrice)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {item.status === 'IN_USE' && (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs"
                          >
                            Đang hoạt động
                          </Badge>
                        )}
                        {isMaintenance && (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-xs"
                          >
                            Đang bảo trì
                          </Badge>
                        )}
                        {isBroken && (
                          <Badge
                            variant="outline"
                            className="border-destructive/30 bg-destructive/10 text-destructive text-xs"
                          >
                            Hỏng hóc
                          </Badge>
                        )}
                        {isLiquidated && (
                          <Badge
                            variant="outline"
                            className="border-border bg-muted text-muted-foreground text-xs"
                          >
                            Đã thanh lý
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        <div>
                          Kế tiếp:{' '}
                          <span className="font-medium text-foreground">
                            {formatDate(item.nextMaintenanceAt)}
                          </span>
                        </div>
                        <div>Bảo hành: {formatDate(item.warrantyExpiresAt)}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Chuyển trạng thái */}
                          {canTransition && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTransitioningEquipment(item)
                                setTransitionData({
                                  status:
                                    ALLOWED_EQUIPMENT_TRANSITIONS[item.status][0] || 'MAINTENANCE',
                                  reason: '',
                                  cost: '0',
                                  nextMaintenanceAt: '',
                                })
                                setTransitionError(null)
                              }}
                              className="h-7 px-2 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                              title="Chuyển trạng thái thiết bị"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Chuyển TT</span>
                            </Button>
                          )}

                          {/* Lịch sử sự kiện */}
                          <button
                            type="button"
                            onClick={() => setViewingEventsEquipment(item)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                            title="Xem lịch sử bảo trì & vòng đời"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          {/* Sửa thông tin */}
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEquipment(item)
                                setEditEquipmentData({
                                  name: item.name,
                                  serialNumber: item.serialNumber || '',
                                  quantity: item.quantity,
                                  unitPrice: String(item.unitPrice),
                                  location: item.location || '',
                                  notes: item.notes || '',
                                })
                                setEditEquipmentError(null)
                              }}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                              title="Chỉnh sửa thiết bị"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ==================================================== */}
      {/* MODALS: CREATE EQUIPMENT                            */}
      {/* ==================================================== */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        className="max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Thêm thiết bị / máy móc mới
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Đăng ký tài sản máy móc vào hệ thống quán để theo dõi bảo trì và khấu hao
          </DialogDescription>
        </DialogHeader>

        {createEquipmentError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{createEquipmentError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            createEquipmentMutation.mutate({
              ...createEquipmentData,
              assetCode: createEquipmentData.assetCode.toUpperCase().trim(),
              quantity: Number(createEquipmentData.quantity),
            })
          }}
          className="mt-4 space-y-3.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">
                Mã tài sản <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="VD: EQ-ESP-01"
                value={createEquipmentData.assetCode}
                onChange={(e) =>
                  setCreateEquipmentData({ ...createEquipmentData, assetCode: e.target.value })
                }
                required
                className="mt-1 uppercase font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Số Serial (nếu có)</label>
              <Input
                type="text"
                placeholder="SN-12345678"
                value={createEquipmentData.serialNumber || ''}
                onChange={(e) =>
                  setCreateEquipmentData({ ...createEquipmentData, serialNumber: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Tên thiết bị <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="VD: Máy pha cà phê La Marzocco Linea PB 2 Group"
              value={createEquipmentData.name}
              onChange={(e) =>
                setCreateEquipmentData({ ...createEquipmentData, name: e.target.value })
              }
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">Số lượng</label>
              <Input
                type="number"
                min="1"
                value={createEquipmentData.quantity}
                onChange={(e) =>
                  setCreateEquipmentData({
                    ...createEquipmentData,
                    quantity: parseInt(e.target.value, 10) || 1,
                  })
                }
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Đơn giá mua (VND)</label>
              <Input
                type="text"
                placeholder="250000000"
                value={createEquipmentData.unitPrice}
                onChange={(e) =>
                  setCreateEquipmentData({ ...createEquipmentData, unitPrice: e.target.value })
                }
                required
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">
                Ngày mua <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={createEquipmentData.purchaseDate}
                onChange={(e) =>
                  setCreateEquipmentData({ ...createEquipmentData, purchaseDate: e.target.value })
                }
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Vị trí lắp đặt</label>
              <Input
                type="text"
                placeholder="Quầy bar chính, Bếp bánh..."
                value={createEquipmentData.location || ''}
                onChange={(e) =>
                  setCreateEquipmentData({ ...createEquipmentData, location: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={createEquipmentMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createEquipmentMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createEquipmentMutation.isPending ? 'Đang tạo...' : 'Lưu thiết bị'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* ==================================================== */}
      {/* MODALS: EDIT EQUIPMENT                              */}
      {/* ==================================================== */}
      <Dialog
        open={!!editingEquipment}
        onOpenChange={(open) => !open && setEditingEquipment(null)}
        className="max-h-[90vh] overflow-y-auto"
      >
        {editingEquipment && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Chỉnh sửa thông tin thiết bị
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Cập nhật thông tin chi tiết cho thiết bị {editingEquipment.name} ({editingEquipment.assetCode})
              </DialogDescription>
            </DialogHeader>

            {editEquipmentError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{editEquipmentError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                updateEquipmentMutation.mutate({
                  id: editingEquipment.id,
                  data: editEquipmentData,
                })
              }}
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="text-xs font-medium text-foreground">Tên thiết bị</label>
                <Input
                  type="text"
                  value={editEquipmentData.name || ''}
                  onChange={(e) =>
                    setEditEquipmentData({ ...editEquipmentData, name: e.target.value })
                  }
                  required
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Số Serial</label>
                  <Input
                    type="text"
                    value={editEquipmentData.serialNumber || ''}
                    onChange={(e) =>
                      setEditEquipmentData({ ...editEquipmentData, serialNumber: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Vị trí lắp đặt</label>
                  <Input
                    type="text"
                    value={editEquipmentData.location || ''}
                    onChange={(e) =>
                      setEditEquipmentData({ ...editEquipmentData, location: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Số lượng</label>
                  <Input
                    type="number"
                    min="1"
                    value={editEquipmentData.quantity || 1}
                    onChange={(e) =>
                      setEditEquipmentData({
                        ...editEquipmentData,
                        quantity: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Đơn giá mua (VND)</label>
                  <Input
                    type="text"
                    value={editEquipmentData.unitPrice || '0'}
                    onChange={(e) =>
                      setEditEquipmentData({ ...editEquipmentData, unitPrice: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingEquipment(null)}
                  disabled={updateEquipmentMutation.isPending}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateEquipmentMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {updateEquipmentMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </Dialog>

      {/* ==================================================== */}
      {/* MODALS: TRANSITION EQUIPMENT STATUS                 */}
      {/* ==================================================== */}
      <Dialog
        open={!!transitioningEquipment}
        onOpenChange={(open) => !open && setTransitioningEquipment(null)}
        className="max-h-[90vh] overflow-y-auto"
      >
        {transitioningEquipment && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Chuyển trạng thái: {transitioningEquipment.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Trạng thái hiện tại: <span className="font-semibold">{transitioningEquipment.status}</span>
              </DialogDescription>
            </DialogHeader>

            {transitionError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{transitionError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                transitionEquipmentMutation.mutate({
                  id: transitioningEquipment.id,
                  data: transitionData,
                })
              }}
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="text-xs font-medium text-foreground">
                  Trạng thái mục tiêu <span className="text-destructive">*</span>
                </label>
                <select
                  aria-label="Chọn trạng thái mục tiêu"
                  value={transitionData.status}
                  onChange={(e) =>
                    setTransitionData({
                      ...transitionData,
                      status: e.target.value as EquipmentStatus,
                    })
                  }
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                >
                  {ALLOWED_EQUIPMENT_TRANSITIONS[transitioningEquipment.status].map((s) => (
                    <option key={s} value={s}>
                      {s === 'IN_USE' && 'IN_USE - Đang hoạt động tốt'}
                      {s === 'MAINTENANCE' && 'MAINTENANCE - Đang bảo trì / Sửa chữa'}
                      {s === 'BROKEN' && 'BROKEN - Hỏng hóc'}
                      {s === 'LIQUIDATED' && 'LIQUIDATED - Thanh lý tài sản'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">
                  Lý do chuyển trạng thái <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="VD: Thay gioăng cao su định kỳ, sửa bơm nước..."
                  value={transitionData.reason}
                  onChange={(e) =>
                    setTransitionData({ ...transitionData, reason: e.target.value })
                  }
                  required
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Chi phí phát sinh (VND)</label>
                  <Input
                    type="text"
                    placeholder="0"
                    value={transitionData.cost || '0'}
                    onChange={(e) =>
                      setTransitionData({ ...transitionData, cost: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">
                    Lịch bảo trì tiếp theo (tùy chọn)
                  </label>
                  <Input
                    type="date"
                    value={transitionData.nextMaintenanceAt || ''}
                    onChange={(e) =>
                      setTransitionData({ ...transitionData, nextMaintenanceAt: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTransitioningEquipment(null)}
                  disabled={transitionEquipmentMutation.isPending}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={transitionEquipmentMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {transitionEquipmentMutation.isPending ? 'Đang chuyển...' : 'Xác nhận chuyển'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </Dialog>

      {/* ==================================================== */}
      {/* MODALS: VIEW EQUIPMENT LIFECYCLE EVENTS             */}
      {/* ==================================================== */}
      <Dialog
        open={!!viewingEventsEquipment}
        onOpenChange={(open) => !open && setViewingEventsEquipment(null)}
        maxWidth="lg"
        className="max-h-[85vh] flex flex-col"
      >
        {viewingEventsEquipment && (
          <>
            <DialogHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 mb-2">
                <History className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Lịch sử bảo trì & vòng đời: {viewingEventsEquipment.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Mã tài sản: <span className="font-mono">{viewingEventsEquipment.assetCode}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-3">
              {isLoadingEvents ? (
                <div className="py-12 text-center text-muted-foreground">
                  Đang tải lịch sử sự kiện...
                </div>
              ) : !equipmentEventsData?.list || equipmentEventsData.list.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Chưa ghi nhận sự kiện bảo trì nào cho thiết bị này.
                </div>
              ) : (
                <div className="relative border-l-2 border-border ml-4 space-y-4 py-2">
                  {equipmentEventsData.list.map((ev) => (
                    <div key={ev.id} className="relative pl-6">
                      <div className="absolute -left-2 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary" />
                      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-foreground">
                            {ev.fromStatus ? `${ev.fromStatus} → ${ev.toStatus}` : ev.toStatus}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {formatDate(ev.occurredAt || ev.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-foreground/90">{ev.reason}</p>
                        {ev.cost && ev.cost !== '0' && (
                          <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                            Chi phí: {formatVnd(ev.cost)}
                          </div>
                        )}
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
                          Thực hiện bởi: {ev.employee?.fullName || 'Hệ thống'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 flex justify-end pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingEventsEquipment(null)}
              >
                Đóng
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  )
}
