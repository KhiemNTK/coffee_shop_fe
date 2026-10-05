import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getItemRecipe, replaceItemRecipe, recipeQuantitySchema, type AdminMenuItem, type ItemRecipe, type RecipeIngredientInput } from '../menu.admin.api'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { Button, Dialog } from '../../../shared/ui'
import { RecipeIngredientsEditor, type IngredientDraft } from './recipe-ingredients-editor'

type RecipeModalProps = { item: AdminMenuItem; employeeId: string; editable: boolean; canReadInventory: boolean; onClose: () => void; onSuccess: () => void }

export function RecipeModal(props: RecipeModalProps) {
  const query = useQuery({
    queryKey: ['private', props.employeeId, 'menu-recipe', props.item.id],
    queryFn: ({ signal }) => getItemRecipe(props.item.id, signal),
    staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  if (!query.isSuccess || query.isFetching) return <Dialog open onClose={props.onClose}>
    <h2 className="pr-8 text-lg font-semibold">Định lượng công thức: {props.item.name}</h2>
    {query.isFetching ? <p role="status">Đang tải công thức…</p> : <><p role="alert">{errorMessage(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}>Tải lại công thức</Button></>}
  </Dialog>
  return <RecipeEditor {...props} initial={query.data} onReload={() => void query.refetch()} />
}

function RecipeEditor({ initial, onReload, ...props }: RecipeModalProps & { initial: ItemRecipe; onReload: () => void }) {
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() => initial.ingredients.map(row => ({
    inventoryItemId: row.inventoryItemId, quantity: row.quantity, name: row.inventoryItem.name, unitName: row.inventoryItem.unit?.name,
  })))
  const [uncertain, setUncertain] = useState(false)
  const [validation, setValidation] = useState('')
  const errorRef = useRef<HTMLParagraphElement>(null)
  const mutation = useMutation({ mutationFn: (payload: RecipeIngredientInput[]) => replaceItemRecipe(props.item.id, payload), onSuccess: props.onSuccess,
    onError: error => setUncertain(!(error instanceof ApiError) || error.status >= 500) })
  return <Dialog open maxWidth="lg" onClose={() => { if (!mutation.isPending) props.onClose() }}>
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault()
      if (!props.editable || mutation.isPending || uncertain) return
      if (ingredients.some(row => !recipeQuantitySchema.safeParse(row.quantity.trim()).success)) {
        setValidation('Kiểm tra định lượng: lớn hơn 0, tối đa 4 chữ số thập phân.'); requestAnimationFrame(() => errorRef.current?.focus()); return
      }
      setValidation('')
      mutation.mutate(ingredients.map(({ inventoryItemId, quantity }) => ({ inventoryItemId, quantity: quantity.trim() })))
    }}>
      <h2 className="break-words pr-8 text-lg font-semibold">Định lượng công thức: {props.item.name}</h2>
      {validation && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">{validation}</p>}
      <fieldset disabled={mutation.isPending || uncertain} className="space-y-4">
        <RecipeIngredientsEditor ingredients={ingredients} onChange={setIngredients} employeeId={props.employeeId} editable={props.editable} canReadInventory={props.canReadInventory} limit={100} />
        {props.editable && initial.ingredients.length > 0 && ingredients.length === 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" required />Xác nhận bỏ toàn bộ công thức</label>}
      </fieldset>
      {mutation.error && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
      {uncertain ? <Button type="button" onClick={onReload}>Đọc lại công thức</Button> : props.editable && <Button type="submit" isLoading={mutation.isPending}>Lưu công thức</Button>}
    </form>
  </Dialog>
}
