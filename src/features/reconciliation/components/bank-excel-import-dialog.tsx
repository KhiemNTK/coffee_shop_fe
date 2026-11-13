import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileSpreadsheet } from 'lucide-react'
import { ApiErrorAlert, Button, Dialog, Input } from '@/shared/ui'
import { previewBankExcel, type BankInput, type BankExcelPreview } from '../reconciliation.api'

const fields = [
  'externalIdColumn',
  'dateColumn',
  'creditColumn',
  'debitColumn',
  'referenceColumn',
  'descriptionColumn',
] as const

export function BankExcelImportDialog({
  file,
  fundId,
  onClose,
  onPreview,
}: {
  file: File
  fundId: string
  onClose: () => void
  onPreview: (input: BankInput) => void
}) {
  const { t } = useTranslation()
  const [sheet, setSheet] = useState('1')
  const [header, setHeader] = useState('1')
  const [columns, setColumns] = useState<BankExcelPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [first, setFirst] = useState('2')
  const [last, setLast] = useState('2')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [moneyFormat, setMoneyFormat] = useState('PLAIN')
  const preview = useMutation({
    retry: false,
    mutationFn: (options: Record<string, string>) => previewBankExcel(file, options),
    onSuccess: (result) => {
      if (result.statement) onPreview(result.statement)
      else {
        setColumns(result)
        setFirst(String(Number(header) + 1))
        setLast(String(Math.min(result.rowCount, Number(header) + 100)))
        setMapping({})
      }
    },
  })
  const labels = {
    externalIdColumn: t('reconciliation.excel.transactionId'),
    dateColumn: t('reconciliation.excel.date'),
    creditColumn: t('reconciliation.excel.credit'),
    debitColumn: t('reconciliation.excel.debit'),
    referenceColumn: t('reconciliation.excel.reference'),
    descriptionColumn: t('reconciliation.excel.description'),
  }
  return (
    <Dialog
      open
      maxWidth="xl"
      label={t('reconciliation.excel.heading')}
      onClose={() => {
        if (!preview.isPending) onClose()
      }}
    >
      <div className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileSpreadsheet className="size-5" />
          {t('reconciliation.excel.heading')}
        </h2>
        <p className="break-all text-sm">{file.name}</p>
        <p className="text-sm text-muted-foreground">{t('reconciliation.excel.hint')}</p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            setColumns(null)
            preview.mutate({ mode: 'COLUMNS', fundId, sheet, headerRow: header })
          }}
        >
          <label className="space-y-1 text-sm">
            <span>{t('reconciliation.excel.sheet')}</span>
            <Input
              type="number"
              min={1}
              max={5}
              value={sheet}
              required
              disabled={preview.isPending}
              onChange={(e) => {
                setSheet(e.target.value)
                setColumns(null)
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t('reconciliation.excel.headerRow')}</span>
            <Input
              type="number"
              min={1}
              max={1000}
              value={header}
              required
              disabled={preview.isPending}
              onChange={(e) => {
                setHeader(e.target.value)
                setColumns(null)
              }}
            />
          </label>
          <Button type="submit" variant="outline" disabled={preview.isPending}>
            {t('reconciliation.excel.readColumns')}
          </Button>
        </form>
        {columns && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (preview.isPending || !from || !to) return
              preview.mutate({
                mode: 'ENTRIES',
                fundId,
                sheet,
                headerRow: header,
                firstRow: first,
                lastRow: last,
                statementFrom: new Date(`${from}T00:00:00+07:00`).toISOString(),
                statementTo: new Date(Date.parse(`${to}T00:00:00+07:00`) + 86400000).toISOString(),
                moneyFormat,
                ...Object.fromEntries(Object.entries(mapping).filter(([, value]) => value !== '')),
              })
            }}
          >
            <p className="text-sm">
              {columns.sheets[Number(sheet) - 1]} ·{' '}
              {t('reconciliation.excel.rowCount', { count: columns.rowCount })}
            </p>
            <fieldset disabled={preview.isPending} className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">{t('reconciliation.excel.mapping')}</legend>
              {fields.map((field) => (
                <label key={field} className="min-w-0 space-y-1 text-sm">
                  <span>{labels[field]}</span>
                  <select
                    aria-label={labels[field]}
                    className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-2"
                    required={field === 'externalIdColumn' || field === 'dateColumn'}
                    value={mapping[field] ?? ''}
                    onChange={(e) =>
                      setMapping((previous) => ({ ...previous, [field]: e.target.value }))
                    }
                  >
                    <option value="">{t('reconciliation.excel.unmapped')}</option>
                    {columns.columns.map((column) => (
                      <option key={column.index} value={column.index}>
                        {column.index}. {column.label || '—'} · {column.sample}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="space-y-1 text-sm">
                <span>{t('reconciliation.excel.firstRow')}</span>
                <Input
                  type="number"
                  required
                  min={Number(header) + 1}
                  max={columns.rowCount}
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t('reconciliation.excel.lastRow')}</span>
                <Input
                  type="number"
                  required
                  min={Number(first)}
                  max={Math.min(columns.rowCount, Number(first) + 99)}
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t('reconciliation.excel.from')}</span>
                <Input
                  type="date"
                  required
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t('reconciliation.excel.to')}</span>
                <Input
                  type="date"
                  required
                  min={from}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>{t('reconciliation.excel.moneyFormat')}</span>
                <select
                  aria-label={t('reconciliation.excel.moneyFormat')}
                  className="h-11 w-full rounded-md border border-border bg-background px-2"
                  value={moneyFormat}
                  onChange={(e) => setMoneyFormat(e.target.value)}
                >
                  <option value="PLAIN">1234567.50</option>
                  <option value="VI">1.234.567,50</option>
                  <option value="EN">1,234,567.50</option>
                </select>
              </label>
            </fieldset>
            <p className="text-sm text-muted-foreground">{t('reconciliation.excel.limits')}</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={preview.isPending}
                onClick={onClose}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" isLoading={preview.isPending}>
                {t('reconciliation.excel.preview')}
              </Button>
            </div>
          </form>
        )}
        {preview.isError && <ApiErrorAlert error={preview.error} />}
      </div>
    </Dialog>
  )
}
