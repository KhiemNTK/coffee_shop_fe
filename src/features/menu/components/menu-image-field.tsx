import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button, Input } from '../../../shared/ui'
import { errorMessage } from '../../../shared/api/client'
import { getMenuImagePolicy, uploadMenuImage } from '../menu-images.api'
import { menuImageUrlSchema } from '../menu.api'

export function MenuImageField({
  id,
  employeeId,
  purpose,
  value,
  onChange,
  onBusyChange,
  onPendingChange,
  disabled,
}: {
  id: string
  employeeId: string
  purpose: 'create' | 'update'
  value: string
  onChange: (url: string) => void
  onBusyChange: (busy: boolean) => void
  onPendingChange: (pending: boolean) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'url' | 'upload'>('url')
  const [file, setFile] = useState<{ value: File; preview: string }>()
  const [validation, setValidation] = useState('')
  const [uploaded, setUploaded] = useState(false)
  const submitting = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const policy = useQuery({
    queryKey: ['private', employeeId, 'menu-image-policy'],
    queryFn: ({ signal }) => getMenuImagePolicy(signal),
    enabled: mode === 'upload',
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  useEffect(() => {
    if (file) return () => URL.revokeObjectURL(file.preview)
  }, [file])
  const mutation = useMutation({
    mutationFn: (selected: File) => uploadMenuImage(selected, purpose),
    retry: false,
    onMutate: () => onBusyChange(true),
    onSuccess: (image) => {
      onChange(image.url)
      setFile(undefined)
      onPendingChange(false)
      setMode('url')
      setUploaded(true)
    },
    onSettled: () => {
      submitting.current = false
      onBusyChange(false)
    },
  })
  const image = file?.preview || (menuImageUrlSchema.safeParse(value).success ? value : '')
  const blocked = disabled || mutation.isPending
  const issue = validation || (mutation.error ? errorMessage(mutation.error) : '')
  return (
    <section
      aria-label={t('menu.image.section')}
      className="min-w-0 space-y-3 border-y border-border py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{t('menu.image.section')}</span>
        <div className="flex rounded-md border border-border p-0.5">
          <Button
            type="button"
            variant={mode === 'url' ? 'secondary' : 'ghost'}
            size="sm"
            disabled={blocked}
            aria-pressed={mode === 'url'}
            onClick={() => {
              setFile(undefined)
              onPendingChange(false)
              setMode('url')
              setValidation('')
              mutation.reset()
            }}
          >
            <Link2 size={15} aria-hidden="true" />
            {t('menu.image.urlMode')}
          </Button>
          <Button
            type="button"
            variant={mode === 'upload' ? 'secondary' : 'ghost'}
            size="sm"
            disabled={blocked}
            aria-pressed={mode === 'upload'}
            onClick={() => setMode('upload')}
          >
            <Upload size={15} aria-hidden="true" />
            {t('menu.image.uploadMode')}
          </Button>
        </div>
      </div>
      {image && (
        <div className="flex items-start gap-3">
          <img
            key={image}
            src={image}
            alt={t('menu.image.preview')}
            referrerPolicy="no-referrer"
            className="aspect-square w-32 max-w-full rounded-md border border-border object-contain"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-destructive"
            disabled={blocked}
            aria-label={t('menu.image.remove')}
            title={t('menu.image.remove')}
            onClick={() => {
              onChange('')
              setFile(undefined)
              onPendingChange(false)
              setUploaded(false)
              mutation.reset()
              setValidation('')
              if (fileRef.current) fileRef.current.value = ''
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
      {mode === 'url' ? (
        <div className="space-y-1">
          <label htmlFor={id} className="text-sm font-medium">
            {t('menu.image.urlLabel')}
          </label>
          <Input
            key="image-url"
            id={id}
            type="url"
            value={value}
            disabled={blocked}
            maxLength={2048}
            onChange={(event) => {
              onChange(event.target.value)
              setUploaded(false)
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {policy.isFetching ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t('menu.image.checking')}
            </p>
          ) : policy.isError ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(policy.error)}
              </p>
              <Button type="button" variant="outline" onClick={() => void policy.refetch()}>
                <RefreshCw size={15} aria-hidden="true" />
                {t('common.retry')}
              </Button>
            </div>
          ) : !policy.data?.enabled ? (
            <div className="space-y-2">
              <p role="status" className="text-sm text-muted-foreground">
                {t('menu.image.disabled')}
              </p>
              <Button type="button" variant="outline" onClick={() => void policy.refetch()}>
                <RefreshCw size={15} aria-hidden="true" />
                {t('common.refresh')}
              </Button>
            </div>
          ) : (
            <>
              <label htmlFor={`${id}-file`} className="block text-sm font-medium">
                {t('menu.image.choose')}
              </label>
              <Input
                key="image-file"
                ref={fileRef}
                id={`${id}-file`}
                type="file"
                accept={policy.data.mimeTypes.join(',')}
                disabled={blocked}
                aria-describedby={issue ? `${id}-error` : undefined}
                aria-invalid={Boolean(issue)}
                onChange={(event) => {
                  const selected = event.target.files?.[0]
                  setValidation('')
                  setUploaded(false)
                  mutation.reset()
                  setFile(undefined)
                  onPendingChange(false)
                  if (!selected) return
                  if (
                    selected.size > policy.data!.maxBytes ||
                    !policy.data!.mimeTypes.some((mime) => mime === selected.type)
                  ) {
                    setValidation(t('menu.image.invalid'))
                    event.target.value = ''
                    return
                  }
                  setFile({ value: selected, preview: URL.createObjectURL(selected) })
                  onPendingChange(true)
                }}
              />
              {file && <p className="break-all text-xs text-muted-foreground">{file.value.name}</p>}
              <Button
                type="button"
                variant="outline"
                disabled={blocked || !file}
                onClick={() => {
                  if (!file || submitting.current) return
                  submitting.current = true
                  mutation.mutate(file.value)
                }}
              >
                <Upload size={16} aria-hidden="true" />
                {mutation.isPending ? t('menu.image.uploading') : t('menu.image.upload')}
              </Button>
            </>
          )}
        </div>
      )}
      {issue && (
        <p id={`${id}-error`} role="alert" className="break-words text-sm text-destructive">
          {issue}
        </p>
      )}
      {uploaded && (
        <p role="status" className="text-sm text-primary">
          {t('menu.image.uploaded')}
        </p>
      )}
    </section>
  )
}
