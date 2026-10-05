import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Pencil, Plus, Trash2, RefreshCw } from 'lucide-react'
import {
  deleteTaxonomy,
  getTaxonomy,
  saveTaxonomy,
  type InventoryCategory,
} from '../inventory.api'
import type { Session } from '../../auth/session'
import { Button, Dialog, Input } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'
import { errorMessage } from '../../../shared/api/client'

export function InventoryTaxonomy() {
  const { employee, authorization } = useOutletContext<Session>()
  const can = (action: string) =>
    authorization.permissionKeys.includes('/inventory_' + action)
  const [kind, setKind] = useState<'categories' | 'units'>('categories')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<InventoryCategory | 'new' | null>(null)
  const [deleting, setDeleting] = useState<InventoryCategory | null>(null)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['private', employee.id, 'inventory-taxonomy', kind, page],
    queryFn: ({ signal }) => getTaxonomy(kind, page, signal),
  })
  const invalidate = () => {
    void client.invalidateQueries({
      queryKey: ['private', employee.id, 'inventory-taxonomy'],
    })
    void client.invalidateQueries({ queryKey: ['inventory-' + kind] })
    void client.invalidateQueries({ queryKey: ['inventory-items'] })
  }
  const remove = useMutation({
    mutationFn: (id: string) => deleteTaxonomy(kind, id),
    onSuccess: () => {
      setDeleting(null)
      invalidate()
    },
  })
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label>
          Danh mục kho
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as typeof kind)
              setPage(1)
              setEditing(null)
              setDeleting(null)
            }}
            className="ml-2 rounded border p-2"
          >
            <option value="categories">Nhóm nguyên liệu</option>
            <option value="units">Đơn vị tính</option>
          </select>
        </label>
        {can('create') && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} />
            Thêm {kind === 'categories' ? 'nhóm nguyên liệu' : 'đơn vị'}
          </Button>
        )}
      </div>
      {query.isError ? (
        <p role="alert">
          {errorMessage(query.error)}{' '}
          <Button variant="outline" onClick={() => void query.refetch()}>
            <RefreshCw size={16} />
            Thử lại
          </Button>
        </p>
      ) : query.isPending ? (
        <p role="status">Đang tải...</p>
      ) : !query.data.list.length ? (
        <p>Chưa có dữ liệu.</p>
      ) : (
        <div className="divide-y border-y">
          {query.data.list.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <h3 className="break-words font-semibold">{item.name}</h3>
                {item.description && (
                  <p className="break-words text-sm">{item.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                {can('update') && (
                  <Button
                    variant="outline"
                    aria-label={'Sửa ' + item.name}
                    title="Sửa"
                    onClick={() => setEditing(item)}
                  >
                    <Pencil size={16} />
                  </Button>
                )}
                {can('delete') && (
                  <Button
                    variant="outline"
                    aria-label={'Xóa ' + item.name}
                    title="Xóa"
                    onClick={() => {
                      setDeleting(item)
                      remove.reset()
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {query.data && (
        <Pagination
          page={page}
          totalPages={query.data.totalPages}
          onPage={setPage}
          disabled={query.isFetching}
        />
      )}
      {editing && (
        <TaxonomyForm
          key={kind + (editing === 'new' ? 'new' : editing.id)}
          kind={kind}
          item={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}
      {deleting && (
        <Dialog
          open
          onClose={() => {
            if (!remove.isPending) setDeleting(null)
          }}
        >
          <h2 className="pr-8 text-lg font-semibold">Xóa {deleting.name}?</h2>
          <p className="my-3">
            Dữ liệu đang được sử dụng sẽ bị backend chặn xóa.
          </p>
          {remove.isError && <p role="alert">{errorMessage(remove.error)}</p>}
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(deleting.id)}
          >
            Xác nhận xóa
          </Button>
        </Dialog>
      )}
    </section>
  )
}

function TaxonomyForm({
  kind,
  item,
  onClose,
  onSaved,
}: {
  kind: 'categories' | 'units'
  item?: InventoryCategory
  onClose: () => void
  onSaved: () => void
}) {
  const mutation = useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      saveTaxonomy(kind, item?.id, input),
    onSuccess: () => {
      onSaved()
      onClose()
    },
  })
  return (
    <Dialog
      open
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (mutation.isPending) return
          const values = new FormData(event.currentTarget)
          mutation.mutate({
            name: String(values.get('name')).trim(),
            ...(kind === 'categories' && {
              description: String(values.get('description')).trim(),
            }),
          })
        }}
      >
        <h2 className="pr-8 text-lg font-semibold">
          {item ? 'Sửa' : 'Thêm'}{' '}
          {kind === 'categories' ? 'nhóm nguyên liệu' : 'đơn vị'}
        </h2>
        <fieldset disabled={mutation.isPending} className="space-y-3">
          <label className="block">
            Tên
            <Input
              name="name"
              required
              maxLength={kind === 'categories' ? 120 : 80}
              defaultValue={item?.name}
            />
          </label>
          {kind === 'categories' && (
            <label className="block">
              Mô tả
              <Input
                name="description"
                maxLength={500}
                defaultValue={item?.description ?? ''}
              />
            </label>
          )}
        </fieldset>
        {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
        <Button type="submit" disabled={mutation.isPending}>
          Lưu
        </Button>
      </form>
    </Dialog>
  )
}
