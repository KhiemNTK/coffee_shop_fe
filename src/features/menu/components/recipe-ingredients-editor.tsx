import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { getInventoryItems, type InventoryItem } from '../../inventory/inventory.api'
import { formatQuantity } from '../../inventory/quantity'
import { recipeQuantitySchema, type RecipeIngredientInput } from '../menu.admin.api'
import { errorMessage } from '../../../shared/api/client'
import { Button, Input } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'

export type IngredientDraft = RecipeIngredientInput & { name?: string; unitName?: string }

export function RecipeIngredientsEditor({ ingredients, onChange, employeeId, editable, canReadInventory, limit }: {
  ingredients: IngredientDraft[]; onChange: (value: IngredientDraft[]) => void; employeeId: string
  editable: boolean; canReadInventory: boolean; limit: number
}) {
  const [keyword, setKeyword] = useState('')
  const search = useDeferredValue(keyword)
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<InventoryItem | null>(null)
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState('')
  const inventory = useQuery({
    queryKey: ['private', employeeId, 'menu-ingredient-options', page, search],
    queryFn: ({ signal }) => getInventoryItems({ page, itemPerPage: 50, keyword: search.trim() || undefined }, signal),
    enabled: editable && canReadInventory,
  })
  return <div className="space-y-3">
    {!ingredients.length && <p className="text-sm text-muted-foreground">Chưa có nguyên liệu.</p>}
    {ingredients.map(ingredient => <div key={ingredient.inventoryItemId} className="grid gap-2 border-b border-border pb-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
      <p className="min-w-0 break-words text-sm">{ingredient.name ?? inventory.data?.list.find(item => item.id === ingredient.inventoryItemId)?.name ?? ingredient.inventoryItemId}{ingredient.unitName ? ` (${ingredient.unitName})` : ''}</p>
      {editable ? <><label className="text-sm">Định lượng / phần<Input type="number" min="0.0001" max="99999999999999.9999" step="0.0001" required value={ingredient.quantity}
        aria-label={`Định lượng ${ingredient.name ?? ingredient.inventoryItemId}`}
        onChange={event => onChange(ingredients.map(row => row.inventoryItemId === ingredient.inventoryItemId ? { ...row, quantity: event.target.value } : row))} /></label>
        <Button type="button" variant="outline" className="justify-self-end" title="Xóa nguyên liệu" aria-label={`Xóa nguyên liệu ${ingredient.name ?? ingredient.inventoryItemId}`}
          onClick={() => onChange(ingredients.filter(row => row.inventoryItemId !== ingredient.inventoryItemId))}><Trash2 size={16} aria-hidden="true" /></Button></>
        : <p className="text-sm tabular-nums">{formatQuantity(ingredient.quantity)}</p>}
    </div>)}
    {editable && canReadInventory && ingredients.length < limit && <div className="space-y-3 border-t border-border pt-3">
      <label className="block text-sm">Tìm nguyên liệu công thức<Input type="search" value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1) }} /></label>
      {inventory.isPending && <p role="status">Đang tải nguyên liệu…</p>}
      {inventory.error && <p role="alert">{errorMessage(inventory.error)} <Button type="button" variant="outline" onClick={() => void inventory.refetch()}>Tải lại nguyên liệu</Button></p>}
      <label className="block text-sm">Nguyên liệu kho<select aria-label="Nguyên liệu kho" className="mt-1 block w-full rounded-md border border-border bg-card p-2" value={picked?.id ?? ''}
        disabled={!inventory.data || inventory.isError} onChange={event => setPicked(inventory.data?.list.find(item => item.id === event.target.value) ?? null)}>
        <option value="">Chọn nguyên liệu</option>
        {picked && !inventory.data?.list.some(item => item.id === picked.id) && <option value={picked.id}>{picked.name}</option>}
        {inventory.data?.list.filter(item => !ingredients.some(row => row.inventoryItemId === item.id)).map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit?.name ?? ''})</option>)}
      </select></label>
      <Pagination page={page} totalPages={inventory.data?.totalPages ?? 0} onPage={setPage} disabled={inventory.isFetching} />
      <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-sm">Định lượng thêm<Input type="number" min="0.0001" max="99999999999999.9999" step="0.0001" value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
        <Button type="button" variant="outline" disabled={!picked || inventory.isError} onClick={() => {
          const parsed = recipeQuantitySchema.safeParse(quantity.trim())
          if (!picked || !parsed.success || ingredients.some(row => row.inventoryItemId === picked.id)) { setError('Chọn nguyên liệu chưa có trong công thức và định lượng hợp lệ.'); return }
          onChange([...ingredients, { inventoryItemId: picked.id, name: picked.name, unitName: picked.unit?.name, quantity: parsed.data }])
          setPicked(null); setQuantity(''); setError('')
        }}><Plus size={16} aria-hidden="true" />Thêm nguyên liệu</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>}
  </div>
}
