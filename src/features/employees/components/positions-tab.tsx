import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2, AlertCircle } from 'lucide-react'
import {
  getPositions,
  createPosition,
  updatePosition,
  deletePosition,
  type Position,
} from '@/features/employees/employees.api'
import { errorMessage } from '@/shared/api/client'
import { formatPrice } from '@/shared/lib/format'
import {
  Button,
  Card,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface PositionsTabProps {
  canUpdate: boolean
  canDelete: boolean
  onToast: (msg: string) => void
  isCreateOpen: boolean
  setIsCreateOpen: (open: boolean) => void
}

export function PositionsTab({
  canUpdate,
  canDelete,
  onToast,
  isCreateOpen,
  setIsCreateOpen,
}: PositionsTabProps) {
  const queryClient = useQueryClient()

  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [positionName, setPositionName] = useState('')
  const [positionSalary, setPositionSalary] = useState('')
  const [positionError, setPositionError] = useState<string | null>(null)

  const {
    data: positionsData,
    isLoading: isLoadingPositions,
  } = useQuery({
    queryKey: ['private', 'positions'],
    queryFn: ({ signal }) => getPositions({ page: 1, itemPerPage: 50 }, signal),
  })

  const invalidateQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['private', 'positions'] })
    void queryClient.invalidateQueries({ queryKey: ['private', 'positions-dropdown'] })
  }

  const savePositionMutation = useMutation({
    mutationFn: async () => {
      if (editingPosition) {
        return updatePosition(editingPosition.id, {
          name: positionName.trim(),
          salary: positionSalary,
        })
      }
      return createPosition({
        name: positionName.trim(),
        salary: positionSalary,
      })
    },
    onSuccess: () => {
      invalidateQueries()
      onToast(editingPosition ? 'Đã cập nhật vị trí công việc' : 'Đã thêm vị trí công việc mới')
      setIsCreateOpen(false)
      setEditingPosition(null)
      setPositionName('')
      setPositionSalary('')
      setPositionError(null)
    },
    onError: (err) => setPositionError(errorMessage(err)),
  })

  const deletePositionMutation = useMutation({
    mutationFn: (id: string) => deletePosition(id),
    onSuccess: () => {
      invalidateQueries()
      onToast('Đã xóa vị trí công việc')
    },
    onError: (err) => onToast(errorMessage(err)),
  })

  return (
    <div className="space-y-4">
      <Card className="border border-border/80 overflow-hidden shadow-xs">
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Tên vị trí</th>
                <th className="px-4 py-3">Lương cơ bản</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoadingPositions ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    Đang tải danh sách vị trí...
                  </td>
                </tr>
              ) : positionsData?.list?.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    Chưa có vị trí công việc nào được định nghĩa.
                  </td>
                </tr>
              ) : (
                positionsData?.list?.map((pos) => (
                  <tr key={pos.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-foreground">{pos.name}</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {formatPrice(pos.salary)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPosition(pos)
                              setPositionName(pos.name)
                              setPositionSalary(String(pos.salary))
                              setPositionError(null)
                              setIsCreateOpen(true)
                            }}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                            title="Sửa vị trí"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa vị trí "${pos.name}"?`)) {
                                deletePositionMutation.mutate(pos.id)
                              }
                            }}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            title="Xóa vị trí"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL: POSITION CREATE / EDIT */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) {
            setEditingPosition(null)
            setPositionName('')
            setPositionSalary('')
            setPositionError(null)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {editingPosition ? 'Chỉnh sửa vị trí công việc' : 'Thêm vị trí công việc mới'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Định danh chức danh nghề nghiệp trong quán (ví dụ: Quản lý ca, Thu ngân, Pha chế)
          </DialogDescription>
        </DialogHeader>

        {positionError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{positionError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!positionName.trim()) {
              setPositionError('Vui lòng nhập tên vị trí')
              return
            }
            savePositionMutation.mutate()
          }}
          className="mt-4 space-y-3.5"
        >
          <div>
            <label className="text-xs font-medium text-foreground">
              Tên vị trí <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="Ví dụ: Barista / Pha chế"
              value={positionName}
              onChange={(e) => {
                setPositionName(e.target.value)
                setPositionError(null)
              }}
              required
              className="mt-1"
            />
          </div>

          <div>
            <label htmlFor="position-salary" className="text-xs font-medium text-foreground">Lương cơ bản (VND)</label>
            <Input
              id="position-salary" type="number" min="0" step="0.01" required
              value={positionSalary}
              disabled={savePositionMutation.isPending}
              onChange={(e) => setPositionSalary(e.target.value)}
              className="mt-1"
            />
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={savePositionMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savePositionMutation.isPending || !positionName.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savePositionMutation.isPending ? 'Đang lưu...' : 'Lưu vị trí'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
