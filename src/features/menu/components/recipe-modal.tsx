import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Boxes, Plus, Trash2 } from 'lucide-react'
import { type AdminMenuItem, getItemRecipe, replaceItemRecipe } from '../menu.admin.api'
import { getInventoryItems } from '../../inventory/inventory.api'
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

export function RecipeModal({
  item,
  employeeId,
  onClose,
  onSuccess,
}: {
  item: AdminMenuItem
  employeeId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [ingredients, setIngredients] = useState<
    Array<{ inventoryItemId: string; name: string; unitName?: string; quantity: string }>
  >([])
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [addQty, setAddQty] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Query recipe from backend
  const recipeQuery = useQuery({
    queryKey: ['private', employeeId, 'menu-recipe', item.id],
    queryFn: async ({ signal }) => {
      const res = await getItemRecipe(item.id, signal)
      setIngredients(
        res.ingredients.map((ing) => ({
          inventoryItemId: ing.inventoryItemId,
          name: ing.inventoryItem.name,
          unitName: ing.inventoryItem.unit?.name,
          quantity: String(ing.quantity),
        })),
      )
      return res
    },
  })

  // Query inventory items to pick
  const inventoryQuery = useQuery({
    queryKey: ['private', employeeId, 'inventory-items-picker'],
    queryFn: ({ signal }) => getInventoryItems({ page: 1, itemPerPage: 100 }, signal),
  })

  const mutation = useMutation({
    mutationFn: () =>
      replaceItemRecipe(
        item.id,
        ingredients.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          quantity: i.quantity,
        })),
      ),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleAddIngredient() {
    if (!selectedInventoryId) return
    if (!addQty || Number(addQty) <= 0) {
      setError('Vui lòng nhập định lượng lớn hơn 0')
      return
    }

    if (ingredients.some((i) => i.inventoryItemId === selectedInventoryId)) {
      setError('Nguyên liệu này đã có trong công thức')
      return
    }

    const inv = inventoryQuery.data?.list.find((i) => i.id === selectedInventoryId)
    if (!inv) return

    setIngredients((prev) => [
      ...prev,
      {
        inventoryItemId: inv.id,
        name: inv.name,
        unitName: inv.unit?.name ?? '',
        quantity: addQty,
      },
    ])
    setSelectedInventoryId('')
    setAddQty('')
    setError(null)
  }

  function handleRemoveIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.inventoryItemId !== id))
  }

  function handleUpdateQuantity(id: string, qty: string) {
    setIngredients((prev) =>
      prev.map((i) => (i.inventoryItemId === id ? { ...i, quantity: qty } : i)),
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            Định lượng công thức: {item.name}
          </DialogTitle>
          <DialogDescription>
            Thiết lập lượng nguyên liệu kho tiêu hao cho mỗi phần đồ uống/món ăn phục vụ.
          </DialogDescription>
        </DialogHeader>

        {recipeQuery.isPending ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">
            Đang tải công thức...
          </div>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Bảng nguyên liệu hiện có */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Nguyên liệu kho</th>
                    <th className="px-4 py-2.5 text-center">Đơn vị</th>
                    <th className="px-4 py-2.5 text-right w-36">Định lượng / phần</th>
                    <th className="px-4 py-2.5 text-right w-16">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ingredients.map((ing) => (
                    <tr key={ing.inventoryItemId} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-semibold text-foreground">{ing.name}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                        {ing.unitName || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Input
                          type="number"
                          step="0.001"
                          min="0.0001"
                          value={ing.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(ing.inventoryItemId, e.target.value)
                          }
                          className="h-8 text-right text-xs"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveIngredient(ing.inventoryItemId)}
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!ingredients.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                        Món này chưa có công thức. Hãy thêm nguyên liệu phía dưới.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bộ chọn thêm nguyên liệu */}
            <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
              <p className="text-xs font-bold text-foreground">Thêm nguyên liệu vào công thức</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-center">
                <div className="sm:col-span-7">
                  <select
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                    value={selectedInventoryId}
                    onChange={(e) => setSelectedInventoryId(e.target.value)}
                    aria-label="Chọn nguyên liệu kho"
                  >
                    <option value="">-- Chọn nguyên liệu từ kho --</option>
                    {inventoryQuery.data?.list
                      .filter((i) => !ingredients.some((ing) => ing.inventoryItemId === i.id))
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit?.name ?? 'ĐV'}) - Tồn: {i.stock}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <Input
                    type="number"
                    step="0.001"
                    min="0.0001"
                    placeholder="Số lượng"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddIngredient}
                    disabled={!selectedInventoryId || !addQty}
                    className="w-full h-8 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" /> Thêm
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || recipeQuery.isPending}
          >
            {mutation.isPending ? 'Đang lưu...' : 'Lưu công thức'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
