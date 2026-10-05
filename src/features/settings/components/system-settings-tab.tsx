import { useState, useDeferredValue } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sliders,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  History,
  AlertCircle,
} from 'lucide-react'
import {
  settingsApi,
  type SettingValueType,
  type SystemSettingItem,
  type CreateSystemSettingInput,
  type UpdateSystemSettingInput,
} from '@/features/settings/settings.api'
import { errorMessage } from '@/shared/api/client'
import { formatDate } from '@/shared/lib/format'
import { Pagination } from '@/shared/ui/pagination'
import {
  Button,
  Badge,
  Card,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface SystemSettingsTabProps {
  canUpdate: boolean
  canDelete: boolean
  onToast: (msg: string) => void
  isCreateOpen: boolean
  setIsCreateOpen: (open: boolean) => void
}

export function SystemSettingsTab({
  canUpdate,
  canDelete,
  onToast,
  isCreateOpen,
  setIsCreateOpen,
}: SystemSettingsTabProps) {
  const queryClient = useQueryClient()

  // Search & Type filter
  const [settingsSearch, setSettingsSearch] = useState('')
  const [page, setPage] = useState(1)
  const [revisionsPage, setRevisionsPage] = useState(1)
  const deferredSettingsSearch = useDeferredValue(settingsSearch)
  const [settingTypeFilter, setSettingTypeFilter] = useState<
    'ALL' | SettingValueType
  >('ALL')

  // Modals state
  const [createSettingData, setCreateSettingData] =
    useState<CreateSystemSettingInput>({
      key: '',
      value: '',
      valueType: 'STRING',
      description: '',
      isPublic: false,
    })
  const [createSettingError, setCreateSettingError] = useState<string | null>(
    null,
  )

  const [editingSetting, setEditingSetting] =
    useState<SystemSettingItem | null>(null)
  const [editSettingValue, setEditSettingValue] = useState('')
  const [editSettingDescription, setEditSettingDescription] = useState('')
  const [editSettingIsPublic, setEditSettingIsPublic] = useState(false)
  const [editSettingError, setEditSettingError] = useState<string | null>(null)

  const [viewingRevisionsKey, setViewingRevisionsKey] = useState<string | null>(
    null,
  )

  // Queries
  const {
    data: settingsData,
    isLoading: isLoadingSettings,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'system-settings-list',
      deferredSettingsSearch,
      settingTypeFilter,
      page,
    ],
    queryFn: ({ signal }) =>
      settingsApi.getSystemSettings(
        {
          keyword: deferredSettingsSearch.trim() || undefined,
          valueType:
            settingTypeFilter === 'ALL' ? undefined : settingTypeFilter,
          page,
          itemPerPage: 20,
        },
        signal,
      ),
  })

  const {
    data: settingRevisionsData,
    isLoading: isLoadingRevisions,
    isFetching: isFetchingRevisions,
    error: revisionsError,
    refetch: refetchRevisions,
  } = useQuery({
    queryKey: ['system-setting-revisions', viewingRevisionsKey, revisionsPage],
    queryFn: ({ signal }) =>
      viewingRevisionsKey
        ? settingsApi.getSystemSettingRevisions(
            viewingRevisionsKey,
            { page: revisionsPage, itemPerPage: 20 },
            signal,
          )
        : null,
    enabled: !!viewingRevisionsKey,
  })

  const invalidateSettings = () => {
    void queryClient.invalidateQueries({ queryKey: ['system-settings-list'] })
  }

  // Mutations
  const createSettingMutation = useMutation({
    mutationFn: (data: CreateSystemSettingInput) =>
      settingsApi.createSystemSetting(data),
    onSuccess: (item) => {
      invalidateSettings()
      onToast(`Đã khởi tạo cấu hình "${item.key}" thành công`)
      setIsCreateOpen(false)
      setCreateSettingData({
        key: '',
        value: '',
        valueType: 'STRING',
        description: '',
        isPublic: false,
      })
      setCreateSettingError(null)
    },
    onError: (err) => setCreateSettingError(errorMessage(err)),
  })

  const updateSettingMutation = useMutation({
    mutationFn: ({
      key,
      data,
    }: {
      key: string
      data: UpdateSystemSettingInput
    }) => settingsApi.updateSystemSetting(key, data),
    onSuccess: (item) => {
      invalidateSettings()
      onToast(`Đã cập nhật cấu hình "${item.key}" thành công`)
      setEditingSetting(null)
      setEditSettingError(null)
    },
    onError: (err) => setEditSettingError(errorMessage(err)),
  })

  const deleteSettingMutation = useMutation({
    mutationFn: ({ key, version }: { key: string; version: number }) =>
      settingsApi.deleteSystemSetting(key, version),
    onSuccess: (res) => {
      invalidateSettings()
      onToast(`Đã xóa cấu hình "${res.key}"`)
      setPage(1)
    },
    onError: (err) => onToast(errorMessage(err)),
  })

  // Format setting value display
  const formatSettingValueDisplay = (val: unknown, type: SettingValueType) => {
    if (type === 'BOOLEAN') {
      return val === true || val === 'true' ? (
        <Badge
          variant="outline"
          className="border-emerald-300 bg-emerald-50 text-emerald-700"
        >
          TRUE
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-border bg-muted text-muted-foreground"
        >
          FALSE
        </Badge>
      )
    }
    if (type === 'JSON') {
      return (
        <code className="text-[11px] font-mono bg-muted/60 px-1.5 py-0.5 rounded text-foreground line-clamp-1 max-w-xs">
          {typeof val === 'string' ? val : JSON.stringify(val)}
        </code>
      )
    }
    return (
      <span className="font-medium text-foreground">{String(val ?? '')}</span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border border-border/80 p-3 shadow-xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo khóa cài đặt (key) hoặc mô tả..."
              value={settingsSearch}
              onChange={(e) => {
                setSettingsSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc theo kiểu dữ liệu tham số"
              value={settingTypeFilter}
              onChange={(e) => {
                setSettingTypeFilter(e.target.value as 'ALL' | SettingValueType)
                setPage(1)
              }}
              className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">Tất cả kiểu dữ liệu</option>
              <option value="STRING">Chuỗi ký tự (STRING)</option>
              <option value="NUMBER">Chỉ số số học (NUMBER)</option>
              <option value="BOOLEAN">Bật / Tắt (BOOLEAN)</option>
              <option value="JSON">Cấu trúc đối tượng (JSON)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Settings Table */}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}{' '}
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </p>
      ) : isLoadingSettings ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="mt-3 text-sm">Đang tải danh sách tham số hệ thống...</p>
        </div>
      ) : !settingsData?.list || settingsData.list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <Sliders className="h-10 w-10 text-muted-foreground mb-2" />
          <h3 className="text-base font-semibold text-foreground">
            Không tìm thấy cấu hình nào
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Chưa có tham số cài đặt nào hoặc không khớp với từ khóa tìm kiếm.
          </p>
        </div>
      ) : (
        <Card className="border border-border/80 overflow-hidden shadow-xs">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Khóa Cài đặt & Mô tả</th>
                  <th className="px-4 py-3">Kiểu</th>
                  <th className="px-4 py-3">Giá trị cấu hình</th>
                  <th className="px-4 py-3">Phiên bản</th>
                  <th className="px-4 py-3">Cập nhật</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {settingsData.list.map((setting) => (
                  <tr
                    key={setting.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-semibold text-xs text-primary">
                        {setting.key}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {setting.description || 'Không có mô tả'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {setting.valueType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      {formatSettingValueDisplay(
                        setting.value,
                        setting.valueType,
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">
                      v{setting.version}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      <div>{setting.updatedBy?.fullName || 'Hệ thống'}</div>
                      <div className="text-[10px]">
                        {formatDate(setting.updatedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Revisions */}
                        <button
                          type="button"
                          onClick={() => {
                            setViewingRevisionsKey(setting.key)
                            setRevisionsPage(1)
                          }}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                          title="Xem lịch sử chỉnh sửa phiên bản"
                        >
                          <History className="h-4 w-4" />
                        </button>

                        {/* Edit */}
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSetting(setting)
                              setEditSettingValue(
                                setting.valueType === 'JSON'
                                  ? JSON.stringify(setting.value, null, 2)
                                  : String(setting.value ?? ''),
                              )
                              setEditSettingDescription(
                                setting.description || '',
                              )
                              setEditSettingIsPublic(setting.isPublic)
                              setEditSettingError(null)
                            }}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                            title="Sửa giá trị cài đặt"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete */}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  `Bạn có chắc chắn muốn xóa cấu hình "${setting.key}" (v${setting.version})?`,
                                )
                              ) {
                                deleteSettingMutation.mutate({
                                  key: setting.key,
                                  version: setting.version,
                                })
                              }
                            }}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            title="Xóa cấu hình"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ==================================================== */}
      {settingsData && !error && (
        <Pagination
          page={page}
          totalPages={settingsData.totalPages}
          onPage={setPage}
          disabled={isFetching}
        />
      )}

      {/* MODALS: CREATE SYSTEM SETTING                       */}
      {/* ==================================================== */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        className="max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Khởi tạo tham số cài đặt mới
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Định nghĩa cấu hình hệ thống toàn quán (khóa định danh dạng
            dot.notation)
          </DialogDescription>
        </DialogHeader>

        {createSettingError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{createSettingError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            let parsedVal: unknown = createSettingData.value
            if (createSettingData.valueType === 'NUMBER') {
              parsedVal = Number(createSettingData.value)
            } else if (createSettingData.valueType === 'BOOLEAN') {
              parsedVal =
                createSettingData.value === 'true' ||
                createSettingData.value === true
            } else if (createSettingData.valueType === 'JSON') {
              try {
                parsedVal = JSON.parse(String(createSettingData.value))
              } catch (err: any) {
                setCreateSettingError(
                  `Định dạng JSON không hợp lệ: ${err.message}`,
                )
                return
              }
            }
            createSettingMutation.mutate({
              ...createSettingData,
              value: parsedVal,
            })
          }}
          className="mt-4 space-y-3.5"
        >
          <div>
            <label className="text-xs font-medium text-foreground">
              Khóa tham số (Key) <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="VD: shop.vat_percent hoặc kitchen.sla_minutes"
              value={createSettingData.key}
              onChange={(e) =>
                setCreateSettingData({
                  ...createSettingData,
                  key: e.target.value.toLowerCase().trim(),
                })
              }
              required
              className="mt-1 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">
                Kiểu dữ liệu
              </label>
              <select
                aria-label="Chọn kiểu dữ liệu"
                value={createSettingData.valueType}
                onChange={(e) =>
                  setCreateSettingData({
                    ...createSettingData,
                    valueType: e.target.value as SettingValueType,
                  })
                }
                className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="STRING">STRING (Chuỗi ký tự)</option>
                <option value="NUMBER">NUMBER (Chỉ số số học)</option>
                <option value="BOOLEAN">BOOLEAN (Bật / Tắt)</option>
                <option value="JSON">JSON (Cấu trúc đối tượng)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">
                Giá trị <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="Nhập giá trị"
                value={String(createSettingData.value)}
                onChange={(e) =>
                  setCreateSettingData({
                    ...createSettingData,
                    value: e.target.value,
                  })
                }
                required
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Mô tả tác dụng
            </label>
            <Input
              type="text"
              placeholder="Giải thích ý nghĩa và phạm vi áp dụng của tham số"
              value={createSettingData.description || ''}
              onChange={(e) =>
                setCreateSettingData({
                  ...createSettingData,
                  description: e.target.value,
                })
              }
              className="mt-1"
            />
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={createSettingMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createSettingMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createSettingMutation.isPending ? 'Đang tạo...' : 'Lưu cấu hình'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* ==================================================== */}
      {/* MODALS: EDIT SYSTEM SETTING                         */}
      {/* ==================================================== */}
      <Dialog
        open={!!editingSetting}
        onOpenChange={(open) => !open && setEditingSetting(null)}
        className="max-h-[90vh] overflow-y-auto"
      >
        {editingSetting && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Cập nhật cấu hình: {editingSetting.key}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Phiên bản hiện tại:{' '}
                <span className="font-mono">v{editingSetting.version}</span>
              </DialogDescription>
            </DialogHeader>

            {editSettingError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{editSettingError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                let parsedVal: unknown = editSettingValue
                if (editingSetting.valueType === 'NUMBER') {
                  parsedVal = Number(editSettingValue)
                } else if (editingSetting.valueType === 'BOOLEAN') {
                  parsedVal = editSettingValue === 'true'
                } else if (editingSetting.valueType === 'JSON') {
                  try {
                    parsedVal = JSON.parse(editSettingValue)
                  } catch (err: any) {
                    setEditSettingError(
                      `Định dạng JSON không hợp lệ: ${err.message}`,
                    )
                    return
                  }
                }
                updateSettingMutation.mutate({
                  key: editingSetting.key,
                  data: {
                    expectedVersion: editingSetting.version,
                    value: parsedVal,
                    description: editSettingDescription,
                    isPublic: editSettingIsPublic,
                  },
                })
              }}
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="text-xs font-medium text-foreground">
                  Giá trị mới ({editingSetting.valueType})
                </label>
                <Input
                  type="text"
                  value={editSettingValue}
                  onChange={(e) => setEditSettingValue(e.target.value)}
                  required
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">
                  Mô tả
                </label>
                <Input
                  type="text"
                  value={editSettingDescription}
                  onChange={(e) => setEditSettingDescription(e.target.value)}
                  className="mt-1"
                />
              </div>

              <DialogFooter className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSetting(null)}
                  disabled={updateSettingMutation.isPending}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateSettingMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {updateSettingMutation.isPending
                    ? 'Đang lưu...'
                    : 'Lưu thay đổi'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </Dialog>

      {/* ==================================================== */}
      {/* MODALS: VIEW SETTING REVISIONS                      */}
      {/* ==================================================== */}
      <Dialog
        open={!!viewingRevisionsKey}
        onOpenChange={(open) => !open && setViewingRevisionsKey(null)}
        maxWidth="lg"
        className="max-h-[85vh] flex flex-col"
      >
        {viewingRevisionsKey && (
          <>
            <DialogHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <History className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Lịch sử phiên bản: {viewingRevisionsKey}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Theo dõi toàn bộ lịch sử điều chỉnh cấu hình và nhân sự thực
                hiện
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-2">
              {revisionsError ? (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(revisionsError)}{' '}
                  <Button
                    variant="outline"
                    onClick={() => void refetchRevisions()}
                  >
                    Thử lại
                  </Button>
                </p>
              ) : isLoadingRevisions ? (
                <div className="py-12 text-center text-muted-foreground">
                  Đang tải lịch sử phiên bản...
                </div>
              ) : !settingRevisionsData?.list ||
                settingRevisionsData.list.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Chưa có phiên bản cũ nào được ghi nhận.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {settingRevisionsData.list.map((rev) => (
                    <div
                      key={rev.id}
                      className="py-2.5 flex items-start justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-muted px-1.5 py-0.5 rounded">
                            v{rev.version}
                          </span>
                          <span className="text-xs font-mono text-foreground">
                            {String(rev.value)}
                          </span>
                        </div>
                        {rev.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {rev.description}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Cập nhật bởi: {rev.employee?.fullName || 'Hệ thống'} •{' '}
                          {formatDate(rev.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {settingRevisionsData && !revisionsError && (
              <Pagination
                page={revisionsPage}
                totalPages={settingRevisionsData.totalPages}
                onPage={setRevisionsPage}
                disabled={isFetchingRevisions}
              />
            )}
            <DialogFooter className="mt-6 flex justify-end pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingRevisionsKey(null)}
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
