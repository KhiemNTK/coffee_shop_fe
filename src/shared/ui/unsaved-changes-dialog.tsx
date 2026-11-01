import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogFooter, DialogTitle, type DialogProps } from './dialog'
import { Button } from './button'

export function UnsavedChangesDialog({
  dirty,
  blocked = false,
  onClose,
  ...props
}: Omit<DialogProps, 'onOpenChange' | 'onClose'> & {
  dirty: boolean
  blocked?: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [discard, setDiscard] = useState(false)
  useEffect(() => {
    if (!dirty || !props.open) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, props.open])
  return (
    <>
      <Dialog
        {...props}
        onClose={() => {
          if (blocked) return
          if (dirty) setDiscard(true)
          else onClose()
        }}
      />
      {discard && (
        <Dialog open maxWidth="sm" onClose={() => setDiscard(false)}>
          <DialogTitle>{t('common.discardTitle')}</DialogTitle>
          <p className="mt-3 text-sm text-muted-foreground">{t('common.discardDescription')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscard(false)}>
              {t('common.keepEditing')}
            </Button>
            <Button variant="destructive" onClick={onClose}>
              {t('common.discardChanges')}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  )
}
