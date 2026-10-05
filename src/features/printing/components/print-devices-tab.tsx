import { useState, useDeferredValue } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  Copy,
  Edit2,
  Key,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { errorMessage } from '@/shared/api/client'
import { Pagination } from '@/shared/ui/pagination'
import {
  printingApi,
  type PrintDevice,
  type PrintDeviceStatus,
  type PrintDeviceType,
} from '../printing.api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/shared/ui'

const EMPTY_DEVICES: PrintDevice[] = []

function formatDateTime(isoString?: string | null) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    const secs = String(d.getSeconds()).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${hours}:${mins}:${secs} ${day}/${month}/${year}`
  } catch {
    return isoString
  }
}

interface PrintDevicesTabProps {
  canManageDevices: boolean
  isCreateOpen: boolean
  setIsCreateOpen: (open: boolean) => void
}

export function PrintDevicesTab({
  canManageDevices,
  isCreateOpen,
  setIsCreateOpen,
}: PrintDevicesTabProps) {
  const queryClient = useQueryClient()

  const [deviceSearch, setDeviceSearch] = useState('')
  const [page, setPage] = useState(1)
  const deferredDeviceSearch = useDeferredValue(deviceSearch)
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<
    'ALL' | PrintDeviceType
  >('ALL')
  const [deviceActiveFilter, setDeviceActiveFilter] = useState<
    'ALL' | 'ACTIVE' | 'INACTIVE'
  >('ALL')

  // Dialog states
  const [editingDevice, setEditingDevice] = useState<PrintDevice | null>(null)
  const [deletingDevice, setDeletingDevice] = useState<PrintDevice | null>(null)
  const [rotatingDevice, setRotatingDevice] = useState<PrintDevice | null>(null)
  const [apiKeyModal, setApiKeyModal] = useState<{
    name: string
    key: string
  } | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Form states for Create Device
  const [createForm, setCreateForm] = useState({
    name: '',
    type: 'RECEIPT' as PrintDeviceType,
    paperSize: '80mm',
    isDefault: true,
  })

  // Form states for Edit Device
  const [editForm, setEditForm] = useState({
    name: '',
    paperSize: '80mm',
    status: 'READY' as PrintDeviceStatus,
    isDefault: false,
    isActive: true,
  })

  const {
    data: devicesData,
    isLoading: isLoadingDevices,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'print-devices',
      deviceTypeFilter,
      deviceActiveFilter,
      deferredDeviceSearch,
      page,
    ],
    queryFn: ({ signal }) =>
      printingApi.getDevices(
        {
          keyword: deferredDeviceSearch.trim() || undefined,
          page,
          type: deviceTypeFilter === 'ALL' ? undefined : deviceTypeFilter,
          isActive:
            deviceActiveFilter === 'ACTIVE'
              ? true
              : deviceActiveFilter === 'INACTIVE'
                ? false
                : undefined,
          itemPerPage: 50,
        },
        signal,
      ),
  })

  const devices = devicesData?.list ?? EMPTY_DEVICES

  // Mutations
  const createDeviceMutation = useMutation({
    mutationFn: printingApi.createDevice,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['print-devices'] })
      setIsCreateOpen(false)
      setCreateForm({
        name: '',
        type: 'RECEIPT',
        paperSize: '80mm',
        isDefault: true,
      })
      if (data.apiKey) {
        setApiKeyModal({ name: data.device.name, key: data.apiKey })
      }
    },
  })

  const updateDeviceMutation = useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string
      dto: Parameters<typeof printingApi.updateDevice>[1]
    }) => printingApi.updateDevice(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['print-devices'] })
      setEditingDevice(null)
    },
  })

  const deleteDeviceMutation = useMutation({
    mutationFn: printingApi.deleteDevice,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['print-devices'] })
      setDeletingDevice(null)
      setPage(1)
    },
  })

  const rotateKeyMutation = useMutation({
    mutationFn: printingApi.rotateKey,
    onSuccess: (data, deviceId) => {
      const targetDevice = devices.find((d) => d.id === deviceId)
      void queryClient.invalidateQueries({ queryKey: ['print-devices'] })
      setRotatingDevice(null)
      if (data.apiKey) {
        setApiKeyModal({
          name: targetDevice?.name || 'Máy in',
          key: data.apiKey,
        })
      }
    },
  })

  const handleOpenEdit = (device: PrintDevice) => {
    setEditingDevice(device)
    setEditForm({
      name: device.name,
      paperSize: device.paperSize,
      status: device.status,
      isDefault: device.isDefault,
      isActive: device.isActive,
    })
  }

  const handleCopyApiKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2500)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <Card className="border border-border/70 shadow-xs">
        <CardContent className="p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên máy in..."
                value={deviceSearch}
                onChange={(e) => {
                  setDeviceSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-8 h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lọc theo loại máy in"
                value={deviceTypeFilter}
                onChange={(e) => {
                  setDeviceTypeFilter(e.target.value as 'ALL' | PrintDeviceType)
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">Tất cả loại máy in</option>
                <option value="RECEIPT">Hóa đơn thu ngân</option>
                <option value="KITCHEN">Chế biến Bếp/Bar</option>
              </select>

              <select
                aria-label="Lọc theo trạng thái kích hoạt"
                value={deviceActiveFilter}
                onChange={(e) => {
                  setDeviceActiveFilter(
                    e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE',
                  )
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">Tất cả tình trạng</option>
                <option value="ACTIVE">Đang kích hoạt</option>
                <option value="INACTIVE">Vô hiệu hóa</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device Cards Grid */}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}{' '}
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </p>
      ) : isLoadingDevices ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Đang tải danh sách thiết bị in...
          </p>
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Printer className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-3 text-base font-bold text-foreground">
            Chưa có thiết bị in nào
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {deviceSearch ||
            deviceTypeFilter !== 'ALL' ||
            deviceActiveFilter !== 'ALL'
              ? 'Không tìm thấy thiết bị nào khớp với bộ lọc tìm kiếm.'
              : 'Hãy thêm máy in mới để kết nối phần mềm in Print Agent tại quầy thu ngân và khu vực bếp.'}
          </p>
          {canManageDevices && (
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 gap-1.5 bg-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Thêm máy in ngay
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => {
            const isOnline = device.isOnline
            return (
              <Card
                key={device.id}
                className={`flex flex-col justify-between border shadow-xs transition-all hover:shadow-sm ${
                  !device.isActive
                    ? 'border-border/60 bg-muted/20 opacity-80'
                    : 'border-border bg-card'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-2.5 w-2.5 rounded-full ${
                          isOnline
                            ? 'bg-emerald-500 animate-pulse'
                            : device.status === 'ERROR'
                              ? 'bg-rose-500'
                              : device.status === 'PAUSED'
                                ? 'bg-amber-500'
                                : 'bg-muted-foreground/50'
                        }`}
                        title={isOnline ? 'Đang trực tuyến' : 'Ngoại tuyến'}
                      />
                      <CardTitle className="text-base font-bold text-foreground truncate max-w-[200px]">
                        {device.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant={
                        device.type === 'RECEIPT' ? 'default' : 'secondary'
                      }
                      className="text-[11px] shrink-0 font-medium"
                    >
                      {device.type === 'RECEIPT' ? 'Hóa đơn' : 'Bếp & Bar'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge variant="outline" className="text-[11px] font-mono">
                      Khổ {device.paperSize}
                    </Badge>
                    {device.isDefault && (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px]">
                        Mặc định
                      </Badge>
                    )}
                    <Badge
                      variant={
                        device.status === 'READY'
                          ? 'outline'
                          : device.status === 'ERROR'
                            ? 'destructive'
                            : 'secondary'
                      }
                      className="text-[11px]"
                    >
                      {device.status === 'READY'
                        ? 'Sẵn sàng'
                        : device.status === 'ERROR'
                          ? 'Báo lỗi'
                          : 'Tạm dừng'}
                    </Badge>
                    {!device.isActive && (
                      <Badge variant="destructive" className="text-[11px]">
                        Vô hiệu hóa
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-3 text-xs">
                  {/* Connection Signal */}
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Radio className="h-3 w-3 text-muted-foreground" />
                        Tín hiệu Agent:
                      </span>
                      <span
                        className={`font-semibold ${
                          isOnline
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {isOnline
                          ? 'Trực tuyến (Online)'
                          : 'Ngoại tuyến (Offline)'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Lần cuối kết nối:</span>
                      <span>{formatDateTime(device.lastSeenAt)}</span>
                    </div>
                  </div>

                  {/* Error banner if present */}
                  {device.lastError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 p-2 text-rose-700 dark:text-rose-400 text-[11px] flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="break-all">{device.lastError}</span>
                    </div>
                  )}
                </CardContent>

                {/* Actions Bar */}
                <div className="border-t border-border/70 p-3 bg-muted/10 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {canManageDevices && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(device)}
                          className="h-8 px-2 text-xs gap-1"
                          title="Sửa cấu hình máy in"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Sửa</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRotatingDevice(device)}
                          className="h-8 px-2 text-xs gap-1 text-indigo-600 dark:text-indigo-400"
                          title="Tạo lại API Key"
                        >
                          <Key className="h-3.5 w-3.5" />
                          <span>Cấp lại Key</span>
                        </Button>
                      </>
                    )}
                  </div>

                  {canManageDevices && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingDevice(device)}
                      className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Xóa máy in"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {devicesData && !error && (
        <Pagination
          page={page}
          totalPages={devicesData.totalPages}
          onPage={setPage}
          disabled={isFetching}
        />
      )}

      {/* CREATE DEVICE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <div className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Thêm Máy in Mới
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Định danh phần cứng và tạo mã xác thực API Key cho dịch vụ Print
              Agent
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3.5 text-xs">
            <div>
              <label
                htmlFor="create-dev-name"
                className="block font-medium text-foreground pb-1"
              >
                Tên máy in <span className="text-rose-500">*</span>
              </label>
              <Input
                id="create-dev-name"
                placeholder="VD: Máy in hóa đơn Quầy 1, Máy in Bếp Nóng..."
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="create-dev-type"
                  className="block font-medium text-foreground pb-1"
                >
                  Loại máy in
                </label>
                <select
                  id="create-dev-type"
                  value={createForm.type}
                  onChange={(e) => {
                    const newType = e.target.value as PrintDeviceType
                    setCreateForm({
                      ...createForm,
                      type: newType,
                      isDefault:
                        newType === 'RECEIPT' ? createForm.isDefault : false,
                    })
                  }}
                  className="w-full h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                >
                  <option value="RECEIPT">Hóa đơn (RECEIPT)</option>
                  <option value="KITCHEN">Bếp & Bar (KITCHEN)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="create-dev-papersize"
                  className="block font-medium text-foreground pb-1"
                >
                  Khổ giấy in
                </label>
                <select
                  id="create-dev-papersize"
                  value={createForm.paperSize}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, paperSize: e.target.value })
                  }
                  className="w-full h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                >
                  <option value="80mm">80mm (Khổ nhiệt chuẩn POS)</option>
                  <option value="58mm">58mm (Khổ nhiệt nhỏ)</option>
                  <option value="76mm">76mm (Khổ kim / Bếp)</option>
                </select>
              </div>
            </div>

            {createForm.type === 'RECEIPT' && (
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={createForm.isDefault}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      isDefault: e.target.checked,
                    })
                  }
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-xs text-foreground">
                  Đặt làm máy in hóa đơn mặc định của quán
                </span>
              </label>
            )}

            {createDeviceMutation.isError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
                {errorMessage(createDeviceMutation.error)}
              </div>
            )}
          </div>

          <DialogFooter className="mt-5">
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="h-9"
            >
              Hủy
            </Button>
            <Button
              disabled={
                !createForm.name.trim() || createDeviceMutation.isPending
              }
              onClick={() => {
                createDeviceMutation.mutate({
                  name: createForm.name.trim(),
                  type: createForm.type,
                  paperSize: createForm.paperSize,
                  isDefault:
                    createForm.type === 'RECEIPT'
                      ? createForm.isDefault
                      : undefined,
                })
              }}
              className="h-9 bg-primary text-primary-foreground"
            >
              {createDeviceMutation.isPending && (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Tạo máy in
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      {/* EDIT DEVICE MODAL */}
      <Dialog
        open={!!editingDevice}
        onOpenChange={(open) => !open && setEditingDevice(null)}
      >
        {editingDevice && (
          <div className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Cập nhật Thiết bị In
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Chỉnh sửa thông số máy in: {editingDevice.name}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label
                  htmlFor="edit-dev-name"
                  className="block font-medium text-foreground pb-1"
                >
                  Tên máy in
                </label>
                <Input
                  id="edit-dev-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-dev-status"
                    className="block font-medium text-foreground pb-1"
                  >
                    Trạng thái
                  </label>
                  <select
                    id="edit-dev-status"
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        status: e.target.value as PrintDeviceStatus,
                      })
                    }
                    className="w-full h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                  >
                    <option value="READY">Sẵn sàng (READY)</option>
                    <option value="PAUSED">Tạm dừng (PAUSED)</option>
                    <option value="ERROR">Báo lỗi (ERROR)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-dev-papersize"
                    className="block font-medium text-foreground pb-1"
                  >
                    Khổ giấy
                  </label>
                  <select
                    id="edit-dev-papersize"
                    value={editForm.paperSize}
                    onChange={(e) =>
                      setEditForm({ ...editForm, paperSize: e.target.value })
                    }
                    className="w-full h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                  >
                    <option value="80mm">80mm</option>
                    <option value="58mm">58mm</option>
                    <option value="76mm">76mm</option>
                  </select>
                </div>
              </div>

              {editingDevice.type === 'RECEIPT' && editForm.isActive && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editForm.isDefault}
                    onChange={(e) =>
                      setEditForm({ ...editForm, isDefault: e.target.checked })
                    }
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-foreground">
                    Máy in hóa đơn mặc định
                  </span>
                </label>
              )}

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) =>
                    setEditForm({ ...editForm, isActive: e.target.checked })
                  }
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-xs text-foreground">
                  Kích hoạt hoạt động cho máy in này
                </span>
              </label>

              {updateDeviceMutation.isError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
                  {errorMessage(updateDeviceMutation.error)}
                </div>
              )}
            </div>

            <DialogFooter className="mt-5">
              <Button
                variant="outline"
                onClick={() => setEditingDevice(null)}
                className="h-9"
              >
                Hủy
              </Button>
              <Button
                disabled={
                  !editForm.name.trim() || updateDeviceMutation.isPending
                }
                onClick={() => {
                  updateDeviceMutation.mutate({
                    id: editingDevice.id,
                    dto: {
                      name: editForm.name.trim(),
                      paperSize: editForm.paperSize,
                      status: editForm.status,
                      isActive: editForm.isActive,
                      isDefault:
                        editingDevice.type === 'RECEIPT'
                          ? editForm.isDefault
                          : undefined,
                    },
                  })
                }}
                className="h-9 bg-primary text-primary-foreground"
              >
                {updateDeviceMutation.isPending && (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {/* ROTATE KEY CONFIRMATION MODAL */}
      <Dialog
        open={!!rotatingDevice}
        onOpenChange={(open) => !open && setRotatingDevice(null)}
      >
        {rotatingDevice && (
          <div className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Cấp lại API Key Thiết bị
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cấp mã khóa mới cho: {rotatingDevice.name}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-3 text-xs text-muted-foreground space-y-2">
              <p>
                Khi cấp lại khóa, API Key hiện tại của máy in sẽ{' '}
                <strong className="text-foreground">
                  hết hiệu lực ngay lập tức
                </strong>
                .
              </p>
              <p>
                Phần mềm Print Agent trên thiết bị này sẽ cần được cập nhật khóa
                mới để tiếp tục nhận lệnh in.
              </p>
            </div>

            <DialogFooter className="mt-5">
              <Button
                variant="outline"
                onClick={() => setRotatingDevice(null)}
                className="h-9"
              >
                Hủy
              </Button>
              <Button
                disabled={rotateKeyMutation.isPending}
                onClick={() => rotateKeyMutation.mutate(rotatingDevice.id)}
                className="h-9 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {rotateKeyMutation.isPending && (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Xác nhận cấp lại
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {/* API KEY DISPLAY MODAL */}
      <Dialog
        open={!!apiKeyModal}
        onOpenChange={(open) => !open && setApiKeyModal(null)}
      >
        {apiKeyModal && (
          <div className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Khóa xác thực Print Agent
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Thiết bị: {apiKeyModal.name}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-2.5 text-amber-800 dark:text-amber-300">
                <p className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Lưu ý bảo mật quan trọng:
                </p>
                <p className="mt-1">
                  Mã API Key chỉ hiển thị duy nhất một lần. Vui lòng sao chép và
                  cấu hình vào file cài đặt của ứng dụng Print Agent trên máy
                  trạm.
                </p>
              </div>

              <div>
                <label className="block text-muted-foreground pb-1">
                  Mã API Key:
                </label>
                <div className="flex items-center gap-1.5">
                  <code className="flex-1 rounded-md border border-border bg-muted/60 p-2 font-mono text-[11px] break-all select-all text-foreground">
                    {apiKeyModal.key}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyApiKey(apiKeyModal.key)}
                    className="h-9 px-3 gap-1 shrink-0"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-5">
              <Button
                onClick={() => setApiKeyModal(null)}
                className="h-9 w-full"
              >
                Tôi đã lưu API Key
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {/* DELETE DEVICE MODAL */}
      <Dialog
        open={!!deletingDevice}
        onOpenChange={(open) => !open && setDeletingDevice(null)}
      >
        {deletingDevice && (
          <div className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Xác nhận Xóa Máy in
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Thao tác xóa mềm thiết bị in khỏi hệ thống
              </DialogDescription>
            </DialogHeader>

            <div className="mt-3 text-xs text-muted-foreground space-y-2">
              <p>
                Bạn có chắc chắn muốn xóa máy in{' '}
                <strong className="text-foreground">
                  {deletingDevice.name}
                </strong>
                ?
              </p>
              <p className="text-rose-600 dark:text-rose-400">
                Các lệnh in đang chờ xử lý sẽ được chuyển trả về hàng đợi chung
                để các máy in khác xử lý.
              </p>
            </div>

            {deleteDeviceMutation.isError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 text-xs">
                {errorMessage(deleteDeviceMutation.error)}
              </div>
            )}

            <DialogFooter className="mt-5">
              <Button
                variant="outline"
                onClick={() => setDeletingDevice(null)}
                className="h-9"
              >
                Hủy
              </Button>
              <Button
                disabled={deleteDeviceMutation.isPending}
                onClick={() => deleteDeviceMutation.mutate(deletingDevice.id)}
                className="h-9 bg-rose-600 text-white hover:bg-rose-700"
              >
                {deleteDeviceMutation.isPending && (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Xác nhận xóa
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>
    </div>
  )
}
