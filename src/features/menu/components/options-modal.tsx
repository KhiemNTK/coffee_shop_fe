import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Boxes, Plus, Trash2 } from 'lucide-react'
import { getItemOptions, replaceItemOptions, recipeQuantitySchema, type AdminMenuItem, type ItemOptions } from '../menu.admin.api'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { Button, Dialog, Input } from '../../../shared/ui'
import { RecipeIngredientsEditor, type IngredientDraft } from './recipe-ingredients-editor'

type OptionsModalProps = { item: AdminMenuItem; employeeId: string; editable: boolean; canReadInventory: boolean; onClose: () => void; onSuccess: () => void }
type OptionDraft = { name: string; priceDelta: string; ingredients: IngredientDraft[] }
type GroupDraft = { name: string; minSelected: number; maxSelected: number; options: OptionDraft[] }

export function OptionsModal(props: OptionsModalProps) {
  const query = useQuery({ queryKey: ['private', props.employeeId, 'menu-options', props.item.id], queryFn: ({ signal }) => getItemOptions(props.item.id, signal),
    staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false })
  if (!query.isSuccess || query.isFetching) return <Dialog open onClose={props.onClose}>
    <h2 className="pr-8 text-lg font-semibold">Cấu hình tùy chọn: {props.item.name}</h2>
    {query.isFetching ? <p role="status">Đang tải tùy chọn…</p> : <><p role="alert">{errorMessage(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}>Tải lại tùy chọn</Button></>}
  </Dialog>
  return <OptionsEditor {...props} initial={query.data} onReload={() => void query.refetch()} />
}

function OptionsEditor({ initial, onReload, ...props }: OptionsModalProps & { initial: ItemOptions; onReload: () => void }) {
  const [groups, setGroups] = useState<GroupDraft[]>(() => initial.optionGroups.map(group => ({
    name: group.name, minSelected: group.minSelected, maxSelected: group.maxSelected,
    options: group.options.map(option => ({ name: option.name, priceDelta: option.priceDelta, ingredients: option.ingredients.map(({ inventoryItemId, quantity, inventoryItem }) => ({ inventoryItemId, quantity, name: inventoryItem?.name, unitName: inventoryItem?.unit?.name })) })),
  })))
  const [activeIngredients, setActiveIngredients] = useState<{ group: number; option: number } | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [validation, setValidation] = useState('')
  const errorRef = useRef<HTMLParagraphElement>(null)
  const mutation = useMutation({ mutationFn: (payload: Parameters<typeof replaceItemOptions>[1]) => replaceItemOptions(props.item.id, payload), onSuccess: props.onSuccess,
    onError: error => setUncertain(!(error instanceof ApiError) || error.status >= 500) })
  const editGroup = (index: number, change: Partial<GroupDraft>) => setGroups(groups.map((group, i) => i === index ? { ...group, ...change } : group))
  const editOption = (groupIndex: number, optionIndex: number, change: Partial<OptionDraft>) => editGroup(groupIndex, {
    options: groups[groupIndex]!.options.map((option, i) => i === optionIndex ? { ...option, ...change } : option),
  })
  const activeOption = activeIngredients ? groups[activeIngredients.group]?.options[activeIngredients.option] : undefined
  return <Dialog open maxWidth="lg" onClose={() => { if (!mutation.isPending) props.onClose() }}>
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault()
      if (!props.editable || mutation.isPending || uncertain) return
      if (groups.some(group => group.options.some(option => option.ingredients.some(row => !recipeQuantitySchema.safeParse(row.quantity.trim()).success)))) {
        setValidation('Kiểm tra định lượng topping: lớn hơn 0, tối đa 4 chữ số thập phân.'); requestAnimationFrame(() => errorRef.current?.focus()); return
      }
      setValidation('')
      mutation.mutate(groups.map(group => ({ name: group.name.trim(), minSelected: group.minSelected, maxSelected: group.maxSelected,
        options: group.options.map(option => ({ name: option.name.trim(), priceDelta: option.priceDelta.trim(), ingredients: option.ingredients.map(({ inventoryItemId, quantity }) => ({ inventoryItemId, quantity: quantity.trim() })) })),
      })))
    }}>
      <h2 className="break-words pr-8 text-lg font-semibold">Cấu hình tùy chọn: {props.item.name}</h2>
      {validation && <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-destructive">{validation}</p>}
      <fieldset disabled={mutation.isPending || uncertain} className="space-y-4">
        {!groups.length && <p className="text-sm">Chưa có nhóm tùy chọn.</p>}
        {groups.map((group, g) => <section key={g} className="space-y-3 border-b border-border pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm">Tên nhóm {g + 1}<Input disabled={!props.editable} required maxLength={80} value={group.name} onChange={event => editGroup(g, { name: event.target.value })} /></label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm">Tối thiểu<Input disabled={!props.editable} type="number" min={0} max={group.maxSelected} step={1} required value={group.minSelected} onChange={event => editGroup(g, { minSelected: Number(event.target.value) })} /></label>
              <label className="min-w-0 flex-1 text-sm">Tối đa<Input disabled={!props.editable} type="number" min={Math.max(1, group.minSelected)} max={group.options.length} step={1} required value={group.maxSelected} onChange={event => editGroup(g, { maxSelected: Number(event.target.value) })} /></label>
              {props.editable && <Button type="button" variant="outline" title="Xóa nhóm" aria-label={`Xóa nhóm ${group.name}`} onClick={() => { setGroups(groups.filter((_, i) => i !== g)); setActiveIngredients(null) }}><Trash2 size={16} aria-hidden="true" /></Button>}
            </div>
          </div>
          {group.options.map((option, o) => <div key={o} className="space-y-3 border-t border-border pt-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
              <label className="min-w-0 text-sm">Lựa chọn {o + 1}<Input disabled={!props.editable} required maxLength={80} value={option.name} onChange={event => editOption(g, o, { name: event.target.value })} /></label>
              <label className="text-sm">Giá cộng thêm<Input disabled={!props.editable} type="number" min="0" max="999999999999999.99" step="0.01" required value={option.priceDelta} onChange={event => editOption(g, o, { priceDelta: event.target.value })} /></label>
              <div className="flex gap-2"><Button type="button" variant="outline" title="Định lượng tùy chọn" aria-label={`Định lượng tùy chọn ${option.name}`} aria-expanded={activeIngredients?.group === g && activeIngredients.option === o}
                onClick={() => setActiveIngredients(activeIngredients?.group === g && activeIngredients.option === o ? null : { group: g, option: o })}><Boxes size={16} aria-hidden="true" /></Button>
                {props.editable && <Button type="button" variant="outline" title="Xóa lựa chọn" aria-label={`Xóa lựa chọn ${option.name}`} disabled={group.options.length === 1}
                  onClick={() => { editGroup(g, { options: group.options.filter((_, i) => i !== o) }); setActiveIngredients(null) }}><Trash2 size={16} aria-hidden="true" /></Button>}</div>
            </div>
            <p className="text-xs text-muted-foreground">{option.ingredients.length} nguyên liệu</p>
          </div>)}
          {props.editable && group.options.length < 10 && <Button type="button" variant="outline" onClick={() => editGroup(g, { options: [...group.options, { name: '', priceDelta: '0', ingredients: [] }] })}><Plus size={16} aria-hidden="true" />Thêm lựa chọn</Button>}
        </section>)}
        {props.editable && groups.length < 5 && <Button type="button" variant="outline" onClick={() => setGroups([...groups, { name: '', minSelected: 0, maxSelected: 1, options: [{ name: '', priceDelta: '0', ingredients: [] }] }])}><Plus size={16} aria-hidden="true" />Thêm nhóm tùy chọn</Button>}
        {props.editable && initial.optionGroups.length > 0 && groups.length === 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" required />Xác nhận xóa toàn bộ nhóm tùy chọn</label>}
      </fieldset>
      {activeIngredients && activeOption && <fieldset disabled={mutation.isPending || uncertain} className="space-y-3 border-t border-border pt-3"><h3 className="break-words text-base font-semibold">Định lượng: {activeOption.name}</h3>
        <RecipeIngredientsEditor key={`${activeIngredients.group}:${activeIngredients.option}`} ingredients={activeOption.ingredients} onChange={ingredients => editOption(activeIngredients.group, activeIngredients.option, { ingredients })} employeeId={props.employeeId} editable={props.editable} canReadInventory={props.canReadInventory} limit={10} />
      </fieldset>}
      {mutation.error && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
      {uncertain ? <Button type="button" onClick={onReload}>Đọc lại tùy chọn</Button> : props.editable && <Button type="submit" isLoading={mutation.isPending}>Lưu tùy chọn</Button>}
    </form>
  </Dialog>
}
