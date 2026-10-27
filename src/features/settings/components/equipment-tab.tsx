import { useState, useDeferredValue } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pagination } from '@/shared/ui/pagination'
import {
  Cpu,
  Search,
  RefreshCw,
  Edit2,
  History,
  ArrowRightLeft,
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
  Input,
} from '@/shared/ui'
import { ALLOWED_EQUIPMENT_TRANSITIONS } from './equipment.constants'
import { CreateEquipmentModal } from './modals/create-equipment-modal'
import { EditEquipmentModal } from './modals/edit-equipment-modal'
import { TransitionEquipmentModal } from './modals/transition-equipment-modal'
import { EquipmentHistoryModal } from './modals/equipment-history-modal'

export interface EquipmentTabProps {
  canCreate: boolean
  canUpdate: boolean
  canTransition: boolean
  onToast: (msg: string) => void
  isCreateOpen: boolean
  setIsCreateOpen: (open: boolean) => void
}

export function EquipmentTab({
  canCreate,
  canUpdate,
  canTransition,
  onToast,
  isCreateOpen,
  setIsCreateOpen,
}: EquipmentTabProps) {
  const queryClient = useQueryClient()

  // Search & Filter
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [page, setPage] = useState(1)
  const [eventsPage, setEventsPage] = useState(1)
  const deferredEquipmentSearch = useDeferredValue(equipmentSearch)
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState<
    'ALL' | EquipmentStatus
  >('ALL')

  // Modals state
  const [createEquipmentData, setCreateEquipmentData] =
    useState<CreateEquipmentInput>(() => ({
      assetCode: '',
      name: '',
      quantity: 1,
      unitPrice: '0',
      purchaseDate: new Date().toISOString().split('T')[0]!,
      location: '',
      notes: '',
    }))
  const [createEquipmentError, setCreateEquipmentError] = useState<
    string | null
  >(null)

  const [editingEquipment, setEditingEquipment] =
    useState<EquipmentItem | null>(null)
  const [editEquipmentData, setEditEquipmentData] =
    useState<UpdateEquipmentInput>({ expectedUpdatedAt: '' })
  const [editEquipmentError, setEditEquipmentError] = useState<string | null>(
    null,
  )

  const [transitioningEquipment, setTransitioningEquipment] =
    useState<EquipmentItem | null>(null)
  const [transitionData, setTransitionData] =
    useState<TransitionEquipmentInput>({
      status: 'MAINTENANCE',
      reason: '',
      cost: '0',
    })
  const [transitionError, setTransitionError] = useState<string | null>(null)

  const [viewingEventsEquipment, setViewingEventsEquipment] =
    useState<EquipmentItem | null>(null)

  // Queries
  const {
    data: equipmentData,
    isLoading: isLoadingEquipment,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'equipment-list',
      deferredEquipmentSearch,
      equipmentStatusFilter,
      page,
    ],
    queryFn: ({ signal }) =>
      settingsApi.getEquipment(
        {
          keyword: deferredEquipmentSearch.trim() || undefined,
          status:
            equipmentStatusFilter === 'ALL' ? undefined : equipmentStatusFilter,
          page,
          itemPerPage: 20,
        },
        signal,
      ),
  })

  const {
    data: equipmentEventsData,
    isLoading: isLoadingEvents,
    isFetching: isFetchingEvents,
    error: eventsError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ['equipment-events', viewingEventsEquipment?.id, eventsPage],
    queryFn: ({ signal }) =>
      viewingEventsEquipment
        ? settingsApi.getEquipmentEvents(
            viewingEventsEquipment.id,
            { page: eventsPage, itemPerPage: 20 },
            signal,
          )
        : null,
    enabled: !!viewingEventsEquipment,
  })

  const invalidateEquipment = () => {
    void queryClient.invalidateQueries({ queryKey: ['equipment-list'] })
  }

  // Mutations
  const createEquipmentMutation = useMutation({
    mutationFn: (data: CreateEquipmentInput) =>
      settingsApi.createEquipment(data),
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
    onError: (err) => { setEditEquipmentError(errorMessage(err)); invalidateEquipment() },
  })

  const transitionEquipmentMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: TransitionEquipmentInput
    }) => settingsApi.transitionEquipment(id, data),
    onSuccess: (res) => {
      invalidateEquipment()
      onToast(
        `Đã chuyển trạng thái thiết bị "${res.equipment.name}" thành công`,
      )
      setTransitioningEquipment(null)
      setTransitionError(null)
    },
    onError: (err) => setTransitionError(errorMessage(err)),
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border border-border/80 p-3 shadow-xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên thiết bị, mã tài sản, serial number..."
              value={equipmentSearch}
              onChange={(e) => {
                setEquipmentSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc theo trạng thái thiết bị"
              value={equipmentStatusFilter}
              onChange={(e) => {
                setEquipmentStatusFilter(
                  e.target.value as 'ALL' | EquipmentStatus,
                )
                setPage(1)
              }}
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
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}{' '}
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </p>
      ) : isLoadingEquipment ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="mt-3 text-sm">Đang tải danh sách trang thiết bị...</p>
        </div>
      ) : !equipmentData?.list || equipmentData.list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <Cpu className="h-10 w-10 text-muted-foreground mb-2" />
          <h3 className="text-base font-semibold text-foreground">
            Không tìm thấy thiết bị nào
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Chưa có thiết bị nào phù hợp với bộ lọc hoặc hệ thống chưa ghi nhận
            tài sản máy móc.
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
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div>
                          <div className="font-semibold text-foreground">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-mono">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
                              {item.assetCode}
                            </span>
                            {item.serialNumber && (
                              <span>SN: {item.serialNumber}</span>
                            )}
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
                        <div>
                          Bảo hành: {formatDate(item.warrantyExpiresAt)}
                        </div>
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
                                    ALLOWED_EQUIPMENT_TRANSITIONS[
                                      item.status
                                    ][0] || 'MAINTENANCE',
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
                              <span className="hidden sm:inline">
                                Chuyển TT
                              </span>
                            </Button>
                          )}

                          {/* Lịch sử sự kiện */}
                          <button
                            type="button"
                            onClick={() => {
                              setViewingEventsEquipment(item)
                              setEventsPage(1)
                            }}
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
                                  expectedUpdatedAt: item.updatedAt,
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
      {equipmentData && !error && (
        <Pagination
          page={page}
          totalPages={equipmentData.totalPages}
          onPage={setPage}
          disabled={isFetching}
        />
      )}

      {/* Modals */}
      <CreateEquipmentModal
        isOpen={canCreate && isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        formData={createEquipmentData}
        setFormData={setCreateEquipmentData}
        error={createEquipmentError}
        isPending={createEquipmentMutation.isPending}
        onSubmit={(e) => {
          e.preventDefault()
          if (!canCreate) return
          createEquipmentMutation.mutate({
            ...createEquipmentData,
            assetCode: createEquipmentData.assetCode.toUpperCase().trim(),
            quantity: Number(createEquipmentData.quantity),
          })
        }}
      />

      <EditEquipmentModal
        equipment={canUpdate ? editingEquipment : null}
        onClose={() => setEditingEquipment(null)}
        formData={editEquipmentData}
        setFormData={setEditEquipmentData}
        error={editEquipmentError}
        isPending={updateEquipmentMutation.isPending}
        onSubmit={(e) => {
          e.preventDefault()
          if (!canUpdate || !editingEquipment) return
          updateEquipmentMutation.mutate({
            id: editingEquipment.id,
            data: editEquipmentData,
          })
        }}
      />

      <TransitionEquipmentModal
        equipment={canTransition ? transitioningEquipment : null}
        onClose={() => setTransitioningEquipment(null)}
        formData={transitionData}
        setFormData={setTransitionData}
        error={transitionError}
        isPending={transitionEquipmentMutation.isPending}
        onSubmit={(e) => {
          e.preventDefault()
          if (!canTransition || !transitioningEquipment) return
          transitionEquipmentMutation.mutate({
            id: transitioningEquipment.id,
            data: transitionData,
          })
        }}
      />

      <EquipmentHistoryModal
        equipment={viewingEventsEquipment}
        onClose={() => setViewingEventsEquipment(null)}
        eventsError={eventsError}
        isLoadingEvents={isLoadingEvents}
        isFetchingEvents={isFetchingEvents}
        refetchEvents={refetchEvents}
        equipmentEventsData={equipmentEventsData}
        eventsPage={eventsPage}
        setEventsPage={setEventsPage}
      />
    </div>
  )
}
