import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus, Sliders, Trash2 } from 'lucide-react'
import { type AdminMenuItem, getItemOptions, replaceItemOptions } from '../menu.admin.api'
import { errorMessage } from '../../../shared/api/client'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'

export function OptionsModal({
  item,
  employeeId,
  onClose,
  onSuccess: _onSuccess,
}: {
  item: AdminMenuItem
  employeeId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [groups, setGroups] = useState<
    Array<{
      name: string
      minSelected: number
      maxSelected: number
      options: Array<{ name: string; priceDelta: string }>
    }>
  >([])
  const [error, setError] = useState<string | null>(null)

  // Query options from backend
  const optionsQuery = useQuery({
    queryKey: ['private', employeeId, 'menu-options', item.id],
    queryFn: async ({ signal }) => {
      const res = await getItemOptions(item.id, signal)
      setGroups(
        res.optionGroups.map((g) => ({
          name: g.name,
          minSelected: g.minSelected,
          maxSelected: g.maxSelected,
          options: g.options.map((o) => ({
            name: o.name,
            priceDelta: String(o.priceDelta),
          })),
        })),
      )
      return res
    },
  })

  const mutation = useMutation({
    mutationFn: () =>
      replaceItemOptions(
        item.id,
        groups.map((g) => ({
          name: g.name.trim(),
          minSelected: g.minSelected,
          maxSelected: g.maxSelected,
          options: g.options.map((o) => ({
            name: o.name.trim(),
            priceDelta: o.priceDelta.trim() || '0',
            ingredients: [],
          })),
        })),
      ),
    onSuccess: () => {
      _onSuccess()
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function handleAddGroup() {
    if (groups.length >= 5) {
      setError('Tối đa 5 nhóm tùy chọn cho mỗi món')
      return
    }
    setGroups((prev) => [
      ...prev,
      {
        name: `Nhóm tùy chọn ${prev.length + 1}`,
        minSelected: 0,
        maxSelected: 1,
        options: [{ name: 'Lựa chọn 1', priceDelta: '0' }],
      },
    ])
  }

  function handleRemoveGroup(groupIndex: number) {
    setGroups((prev) => prev.filter((_, idx) => idx !== groupIndex))
  }

  function handleAddOption(groupIndex: number) {
    setGroups((prev) =>
      prev.map((g, idx) => {
        if (idx !== groupIndex) return g
        if (g.options.length >= 10) return g
        return {
          ...g,
          options: [...g.options, { name: `Lựa chọn ${g.options.length + 1}`, priceDelta: '0' }],
        }
      }),
    )
  }

  function handleRemoveOption(groupIndex: number, optionIndex: number) {
    setGroups((prev) =>
      prev.map((g, idx) => {
        if (idx !== groupIndex) return g
        if (g.options.length <= 1) return g
        return {
          ...g,
          options: g.options.filter((_, oIdx) => oIdx !== optionIndex),
        }
      }),
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            Cấu hình tùy chọn: {item.name}
          </DialogTitle>
          <DialogDescription>
            Tạo các nhóm tùy chọn (Size, Đường, Đá, Topping) và đơn giá cộng thêm (price delta).
          </DialogDescription>
        </DialogHeader>

        {optionsQuery.isPending ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">
            Đang tải tùy chọn món...
          </div>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            {groups.map((group, gIdx) => (
              <div key={gIdx} className="rounded-lg border border-border bg-card p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={group.name}
                    onChange={(e) => {
                      const val = e.target.value
                      setGroups((prev) =>
                        prev.map((g, idx) => (idx === gIdx ? { ...g, name: val } : g)),
                      )
                    }}
                    placeholder="Tên nhóm (VD: Kích cỡ / Size, Mức đường)"
                    className="font-bold text-sm h-8 max-w-xs"
                  />

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Chọn tối thiểu:</span>
                    <Input
                      type="number"
                      min="0"
                      max="20"
                      value={group.minSelected}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setGroups((prev) =>
                          prev.map((g, idx) => (idx === gIdx ? { ...g, minSelected: val } : g)),
                        )
                      }}
                      className="w-16 h-7 text-center text-xs"
                    />

                    <span>Tối đa:</span>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={group.maxSelected}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setGroups((prev) =>
                          prev.map((g, idx) => (idx === gIdx ? { ...g, maxSelected: val } : g)),
                        )
                      }}
                      className="w-16 h-7 text-center text-xs"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveGroup(gIdx)}
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Sub Options */}
                <div className="pl-3 border-l-2 border-primary/20 space-y-2">
                  {group.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <Input
                        value={opt.name}
                        onChange={(e) => {
                          const val = e.target.value
                          setGroups((prev) =>
                            prev.map((g, idx) => {
                              if (idx !== gIdx) return g
                              return {
                                ...g,
                                options: g.options.map((o, oSub) =>
                                  oSub === oIdx ? { ...o, name: val } : o,
                                ),
                              }
                            }),
                          )
                        }}
                        placeholder="Tên lựa chọn (VD: Size L, 50% Đá)"
                        className="text-xs h-7 flex-1"
                      />

                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">+₫</span>
                        <Input
                          type="number"
                          step="1000"
                          value={opt.priceDelta}
                          onChange={(e) => {
                            const val = e.target.value
                            setGroups((prev) =>
                              prev.map((g, idx) => {
                                if (idx !== gIdx) return g
                                return {
                                  ...g,
                                  options: g.options.map((o, oSub) =>
                                    oSub === oIdx ? { ...o, priceDelta: val } : o,
                                  ),
                                }
                              }),
                            )
                          }}
                          className="w-24 text-right text-xs h-7"
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(gIdx, oIdx)}
                        disabled={group.options.length <= 1}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {group.options.length < 10 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddOption(gIdx)}
                      className="h-6 text-xs text-primary gap-1"
                    >
                      <Plus className="h-3 w-3" /> Thêm lựa chọn
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {groups.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddGroup}
                className="w-full text-xs gap-1.5 border-dashed"
              >
                <Plus className="h-4 w-4" /> Thêm nhóm tùy chọn mới
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || optionsQuery.isPending}
          >
            {mutation.isPending ? 'Đang lưu...' : 'Lưu tùy chọn'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
