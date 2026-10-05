import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminCategories, getKitchenStationsList } from '../menu.admin.api'
import { errorMessage } from '../../../shared/api/client'
import { Button, Input } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'

export type CatalogSelection = { id: string; name: string } | null

export function CatalogPicker({ employeeId, resource, label, selected, onChange, emptyLabel, required = false }: {
  employeeId: string; resource: 'category' | 'station'; label: string; selected: CatalogSelection
  onChange: (value: CatalogSelection) => void; emptyLabel: string; required?: boolean
}) {
  const id = useId()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['private', employeeId, resource === 'category' ? 'admin-categories' : 'kitchen-stations', 'lookup', page, keyword],
    queryFn: ({ signal }) => resource === 'category'
      ? getAdminCategories({ page, itemPerPage: 50, keyword }, signal)
      : getKitchenStationsList({ page, keyword }, signal),
  })
  const list = query.data?.list ?? []
  return <div className="min-w-0 space-y-2" role="group" aria-label={label}>
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    <Input aria-label={`Tìm ${label.toLowerCase()}`} maxLength={120} value={keyword}
      onChange={event => { setKeyword(event.target.value); setPage(1) }} />
    <select id={id} required={required} value={selected?.id ?? ''}
      disabled={!query.isSuccess || query.isFetching}
      className="w-full min-w-0 rounded-md border border-input bg-card p-2 text-sm"
      onChange={event => onChange(list.find(row => row.id === event.target.value) ?? null)}>
      <option value="">{emptyLabel}</option>
      {selected && !list.some(row => row.id === selected.id) && <option value={selected.id}>{selected.name}</option>}
      {list.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
    </select>
    {query.isFetching ? <p role="status" className="text-sm text-muted-foreground">Đang tải…</p>
      : query.isError ? <div><p role="alert" className="text-sm text-destructive">{errorMessage(query.error)}</p>
        <Button type="button" variant="outline" onClick={() => void query.refetch()}>Tải lại {label.toLowerCase()}</Button></div>
      : query.isSuccess && <>
        {!list.length && <p className="text-sm text-muted-foreground">Không có kết quả trong trang này.</p>}
        {(query.data.totalPages > 1 || page > 1) && <Pagination page={page} totalPages={query.data.totalPages} disabled={query.isFetching} onPage={setPage} />}
        {page > Math.max(1, query.data.totalPages) && <Button type="button" variant="outline" onClick={() => setPage(1)}>Về trang đầu</Button>}
      </>}
  </div>
}
