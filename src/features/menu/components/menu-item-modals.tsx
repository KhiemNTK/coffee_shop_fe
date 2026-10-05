import { useId, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type AdminMenuItem, type AdminMenuItemDetail, createMenuItem, getAdminItem, updateMenuItem, deleteMenuItem } from '../menu.admin.api'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { Button, Input, Dialog, DialogFooter, DialogHeader, DialogTitle } from '../../../shared/ui'
import { CatalogPicker, type CatalogSelection } from './catalog-picker'

type ItemModalProps = { employeeId: string; canReadStations: boolean; onClose: () => void; onSuccess: () => void; onSettled: () => void }

export function CreateMenuItemModal(props: ItemModalProps) {
  return <MenuItemEditor {...props} />
}

export function EditMenuItemModal(props: ItemModalProps & { item: AdminMenuItem }) {
  const query = useQuery({
    queryKey: ['private', props.employeeId, 'admin-menu-detail', props.item.id],
    queryFn: ({ signal }) => getAdminItem(props.item.id, signal),
    staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  if (!query.isSuccess || query.isFetching) return <Dialog open onClose={props.onClose}>
    <h2 className="pr-8 text-lg font-semibold">Cập nhật thông tin món</h2>
    {query.isFetching ? <p role="status">Đang tải món…</p> : <><p role="alert">{errorMessage(query.error)}</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Tải lại món</Button></>}
  </Dialog>
  return <MenuItemEditor {...props} initial={query.data} onReload={() => void query.refetch()} />
}

function MenuItemEditor({ initial, onReload, ...props }: ItemModalProps & { initial?: AdminMenuItemDetail; onReload?: () => void }) {
  const id = useId()
  const [name, setName] = useState(initial?.name ?? '')
  const [price, setPrice] = useState(initial?.price ?? '')
  const [category, setCategory] = useState<CatalogSelection>(initial?.category ?? null)
  const [station, setStation] = useState<CatalogSelection>(initial?.kitchenStationId
    ? { id: initial.kitchenStationId, name: initial.kitchenStation?.name ?? initial.kitchenStationId } : null)
  const [validation, setValidation] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createMenuItem>[0] | Parameters<typeof updateMenuItem>[1]) => initial
      ? updateMenuItem(initial.id, payload)
      : createMenuItem(payload as Parameters<typeof createMenuItem>[0]),
    onSuccess: props.onSuccess, onSettled: props.onSettled,
    onError: error => setUncertain(!(error instanceof ApiError) || error.status >= 500),
  })
  return <Dialog open onClose={() => { if (!mutation.isPending) props.onClose() }}>
    <DialogHeader><DialogTitle>{initial ? 'Cập nhật thông tin món' : 'Tạo món mới'}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault()
      if (mutation.isPending || uncertain) return
      if (!name.trim() || !/^(0|[1-9]\d{0,14})(\.\d{1,2})?$/.test(price.trim()) || !category) {
        setValidation('Kiểm tra tên món, danh mục và giá không âm, tối đa 2 chữ số thập phân.')
        requestAnimationFrame(() => errorRef.current?.focus()); return
      }
      setValidation('')
      if (!initial) {
        mutation.mutate({ name: name.trim(), price: price.trim(), categoryId: category.id,
          ...(props.canReadStations ? { kitchenStationId: station?.id ?? null } : {}) })
        return
      }
      const changes: Parameters<typeof updateMenuItem>[1] = {
        ...(name.trim() !== initial.name ? { name: name.trim() } : {}),
        ...(price.trim() !== initial.price ? { price: price.trim() } : {}),
        ...(category.id !== initial.categoryId ? { categoryId: category.id } : {}),
        ...(props.canReadStations && (station?.id ?? null) !== initial.kitchenStationId ? { kitchenStationId: station?.id ?? null } : {}),
      }
      if (Object.keys(changes).length) mutation.mutate(changes)
      else props.onClose()
    }}>
      {validation && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">{validation}</p>}
      <fieldset disabled={mutation.isPending || uncertain} className="space-y-4">
        <div className="space-y-1"><label htmlFor={`${id}-name`} className="text-sm font-medium">Tên món</label>
          <Input id={`${id}-name`} value={name} onChange={event => setName(event.target.value)} required maxLength={160} /></div>
        <div className="space-y-1"><label htmlFor={`${id}-price`} className="text-sm font-medium">Đơn giá (VNĐ)</label>
          <Input id={`${id}-price`} type="text" inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} required maxLength={18} /></div>
        <CatalogPicker employeeId={props.employeeId} resource="category" label="Danh mục món" selected={category}
          onChange={setCategory} required emptyLabel="Chọn danh mục" />
        {props.canReadStations ? <CatalogPicker employeeId={props.employeeId} resource="station" label="Quầy chế biến phụ trách"
          selected={station} onChange={setStation} emptyLabel="Không gán quầy cụ thể" />
          : initial?.kitchenStation && <p className="text-sm">Quầy chế biến: {initial.kitchenStation.name}</p>}
      </fieldset>
      {mutation.error && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
      {uncertain && <p role="alert" className="text-sm">Chưa xác định kết quả lưu món.</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={props.onClose}>Đóng</Button>
        {uncertain ? onReload && <Button type="button" onClick={onReload}>Đọc lại món</Button>
          : <Button type="submit" disabled={mutation.isPending || !category}>{mutation.isPending ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Tạo món'}</Button>}
      </DialogFooter>
    </form>
  </Dialog>
}

export function DeleteMenuItemModal({ item, onClose, onSuccess }: { item: AdminMenuItem; onClose: () => void; onSuccess: () => void }) {
  const mutation = useMutation({ mutationFn: () => deleteMenuItem(item.id), onSuccess })
  return <Dialog open onClose={() => { if (!mutation.isPending) onClose() }}>
    <DialogHeader><DialogTitle>Xác nhận xóa món</DialogTitle></DialogHeader>
    <p className="break-words">Xóa món “{item.name}” khỏi thực đơn?</p>
    {mutation.error && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
    <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={onClose}>Hủy</Button>
      <Button variant="destructive" onClick={() => { if (!mutation.isPending) mutation.mutate() }} disabled={mutation.isPending}>Xóa món</Button></DialogFooter>
  </Dialog>
}
