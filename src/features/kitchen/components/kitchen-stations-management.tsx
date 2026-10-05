import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Pencil, Plus, Trash2, RefreshCw } from 'lucide-react'
import type { Session } from '../../auth/session'
import {
  deleteStation,
  getStationPage,
  saveStation,
  type KitchenStation,
  type StationInput,
} from '../kitchen.api'
import { printingApi } from '../../printing/printing.api'
import { Button, Dialog, Input } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'
import { errorMessage } from '../../../shared/api/client'

export function KitchenStationsManagement() {
  const { employee, authorization } = useOutletContext<Session>()
  const canManage = authorization.permissionKeys.includes(
    '/kitchen-stations_manage',
  )
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<KitchenStation | 'new' | null>(null)
  const [deleting, setDeleting] = useState<KitchenStation | null>(null)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['private', employee.id, 'station-management', page],
    queryFn: ({ signal }) => getStationPage(page, signal),
  })
  const invalidate = () => {
    void client.invalidateQueries({
      queryKey: ['private', employee.id, 'station-management'],
    })
    void client.invalidateQueries({ queryKey: ['kitchen'] })
    void client.invalidateQueries({
      queryKey: ['private', employee.id, 'kitchen-stations'],
    })
  }
  const remove = useMutation({
    mutationFn: (id: string) => deleteStation(id),
    onSuccess: () => {
      setDeleting(null)
      invalidate()
    },
  })
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Trạm bếp & SLA</h2>
      {canManage && (
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          Thêm trạm bếp
        </Button>
      )}
      {query.isError ? (
        <p role="alert">
          {errorMessage(query.error)}{' '}
          <Button variant="outline" onClick={() => void query.refetch()}>
            <RefreshCw size={16} />
            Thử lại
          </Button>
        </p>
      ) : query.isPending ? (
        <p role="status">Đang tải trạm bếp...</p>
      ) : !query.data.list.length ? (
        <p>Chưa có trạm bếp.</p>
      ) : (
        <div className="divide-y border-y">
          {query.data.list.map((station) => (
            <div
              key={station.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <h3 className="wrap-break-word font-semibold">
                  {station.code} · {station.name}
                </h3>
                <p className="text-sm">
                  SLA: {station.prepSlaSeconds} giây ·{' '}
                  {station.isActive ? 'Đang hoạt động' : 'Đã ngừng'}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    aria-label={'Sửa trạm ' + station.name}
                    title="Sửa trạm"
                    onClick={() => setEditing(station)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    aria-label={'Xóa trạm ' + station.name}
                    title="Xóa trạm"
                    onClick={() => {
                      setDeleting(station)
                      remove.reset()
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              )}
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
        <StationForm
          key={editing === 'new' ? 'new' : editing.id}
          station={editing === 'new' ? undefined : editing}
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
          <h2 className="pr-8 text-lg font-semibold">
            Xóa trạm {deleting.name}?
          </h2>
          <p className="my-3">
            Trạm còn món được gán hoặc ticket đang làm sẽ bị backend chặn xóa.
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

function StationForm({
  station,
  onClose,
  onSaved,
}: {
  station?: KitchenStation
  onClose: () => void
  onSaved: () => void
}) {
  const { employee, authorization } = useOutletContext<Session>()
  const devices = useQuery({
    queryKey: ['private', employee.id, 'kitchen-print-options'],
    queryFn: ({ signal }) =>
      printingApi.getDevices({ type: 'KITCHEN', itemPerPage: 100 }, signal),
    enabled: authorization.permissionKeys.includes('/print-devices_read'),
  })
  const mutation = useMutation({
    mutationFn: (data: StationInput) => saveStation(station?.id, data),
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
            code: String(values.get('code')).trim(),
            name: String(values.get('name')).trim(),
            prepSlaSeconds: Number(values.get('sla')),
            printDeviceId: String(values.get('printer')).trim() || null,
            ...(station && { isActive: values.has('active') }),
          })
        }}
      >
        <h2 className="pr-8 text-lg font-semibold">
          {station ? 'Sửa trạm bếp' : 'Thêm trạm bếp'}
        </h2>
        <fieldset disabled={mutation.isPending} className="space-y-3">
          <label className="block">
            Mã trạm
            <Input
              name="code"
              required
              maxLength={32}
              pattern="[A-Za-z0-9_-]+"
              defaultValue={station?.code}
            />
          </label>
          <label className="block">
            Tên trạm
            <Input
              name="name"
              required
              maxLength={120}
              defaultValue={station?.name}
            />
          </label>
          <label className="block">
            SLA (giây)
            <Input
              name="sla"
              type="number"
              required
              min={30}
              max={86400}
              step={1}
              defaultValue={station?.prepSlaSeconds ?? 300}
            />
          </label>
          <label className="block">
            Máy in bếp
            <select
              name="printer"
              defaultValue={station?.printDeviceId ?? ''}
              className="block w-full rounded border p-2"
            >
              <option value="">Không gán máy in</option>
              {station?.printDeviceId &&
                !devices.data?.list.some(
                  (device) => device.id === station.printDeviceId,
                ) && (
                  <option value={station.printDeviceId}>Máy in hiện tại</option>
                )}
              {devices.data?.list.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </label>
          {station && (
            <label className="flex gap-2">
              <input
                name="active"
                type="checkbox"
                defaultChecked={station.isActive}
              />
              Đang hoạt động
            </label>
          )}
        </fieldset>
        {devices.isError && <p role="alert">{errorMessage(devices.error)}</p>}
        {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
        <Button type="submit" disabled={mutation.isPending}>
          Lưu trạm
        </Button>
      </form>
    </Dialog>
  )
}
