import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { getAvailableReservationTables } from '../reservations.api'
import { useDebouncedSearch } from '@/shared/lib/use-debounced-search'
import { errorMessage } from '@/shared/api/client'
import { Button, Input } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { tableAvailabilityKey, type ReservationWindow } from '../reservation-availability'

export function ReservationTablePicker({
  employeeId,
  canReadTables,
  window,
  excludeReservationId,
  value,
  onChange,
  onConfirmed,
  id,
  initial,
}: {
  employeeId: string
  canReadTables: boolean
  window: ReservationWindow | null
  excludeReservationId?: number
  value: string
  onChange: (value: string) => void
  onConfirmed: (value: string | null) => void
  id: string
  initial?: { id: string; name: string }
}) {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const search = useDebouncedSearch(keyword)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(initial)
  const query = useQuery({
    queryKey: [
      'private',
      employeeId,
      'reservation-available-tables',
      window,
      excludeReservationId,
      page,
      search,
    ],
    queryFn: ({ signal }) =>
      getAvailableReservationTables(
        { ...window!, excludeReservationId, page, keyword: search },
        signal,
      ),
    enabled: canReadTables && Boolean(window),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const listed =
    query.isSuccess && !query.isFetching && query.data.list.some((row) => row.id === value)
  const lookup = useQuery({
    queryKey: [
      'private',
      employeeId,
      'reservation-table-validation',
      window,
      excludeReservationId,
      value,
    ],
    queryFn: ({ signal }) =>
      getAvailableReservationTables({ ...window!, excludeReservationId, tableId: value }, signal),
    enabled: canReadTables && Boolean(window && value) && query.isSuccess && !query.isFetching && !listed,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const valid =
    canReadTables &&
    !query.isError &&
    Boolean(window && value) &&
    (listed ||
      (lookup.isSuccess && !lookup.isFetching && lookup.data.list.some((row) => row.id === value)))
  const proof = valid ? tableAvailabilityKey(window, value, excludeReservationId) : null
  useEffect(() => onConfirmed(proof), [onConfirmed, proof])
  const current =
    query.data?.list.find((row) => row.id === value) ??
    lookup.data?.list.find((row) => row.id === value) ??
    selected
  const disabled =
    !canReadTables || !window || !query.isSuccess || query.isFetching || search !== keyword.trim()
  return (
    <div className="min-w-0 space-y-2" role="group" aria-label={t('reservation.table')}>
      <label htmlFor={id} className="text-sm font-medium">
        {t('reservation.table')}
      </label>
      <Input
        type="search"
        value={keyword}
        maxLength={100}
        disabled={!canReadTables || !window}
        aria-label={t('reservation.searchTable')}
        placeholder={t('reservation.searchTable')}
        onChange={(event) => {
          setKeyword(event.target.value)
          setPage(1)
        }}
      />
      <select
        id={id}
        required
        value={value}
        disabled={disabled}
        className="h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm"
        onChange={(event) => {
          setSelected(query.data?.list.find((row) => row.id === event.target.value))
          onChange(event.target.value)
        }}
      >
        <option value="">{t('reservation.chooseTable')}</option>
        {value && !query.data?.list.some((row) => row.id === value) && (
          <option value={value}>{current?.name ?? value}</option>
        )}
        {query.data?.list.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
      {!canReadTables ? (
        <p className="text-sm text-muted-foreground">{t('reservation.noTableAccess')}</p>
      ) : !window ? (
        <p className="text-sm text-muted-foreground">{t('reservation.chooseWindow')}</p>
      ) : query.isFetching || (value && lookup.isFetching) ? (
        <p role="status" className="text-sm">
          {t('reservation.checkingTables')}
        </p>
      ) : query.isError || (!listed && value && lookup.isError) ? (
        <div role="alert" className="text-sm text-destructive">
          <p>{errorMessage(query.error ?? lookup.error)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void query.refetch()
              if (value) void lookup.refetch()
            }}
          >
            <RefreshCw size={16} />
            {t('reservation.reloadTables')}
          </Button>
        </div>
      ) : (
        <>
          {value && !valid && (
            <p role="alert" className="text-sm text-destructive">
              {t('reservation.tableUnavailable')}
            </p>
          )}
          {query.isSuccess && !query.data.list.length && (
            <p role="status" className="text-sm">
              {t('reservation.noAvailableTables')}
            </p>
          )}
        </>
      )}
      {query.isSuccess && (query.data.totalPages > 1 || page > 1) && (
        <Pagination
          page={page}
          totalPages={query.data.totalPages}
          disabled={query.isFetching}
          onPage={setPage}
        />
      )}
      <p className="text-xs text-muted-foreground">{t('reservation.availabilityNotice')}</p>
    </div>
  )
}
