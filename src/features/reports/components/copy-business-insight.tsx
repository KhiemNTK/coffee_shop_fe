import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { Button } from '../../../shared/ui'
import type { BusinessInsight } from '../business-insights.api'
import { formatBusinessInsightText } from '../business-insight-format'

export function CopyBusinessInsight({ job }: { job: BusinessInsight }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const text = formatBusinessInsightText(job)
  async function copy() {
    setState('copying')
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch { setState('error') }
  }
  return <div className="min-w-0 max-w-full space-y-2">
    <Button variant="outline" onClick={() => void copy()} disabled={state === 'copying'} className="gap-2">
      {state === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {t(state === 'copied' ? 'insights.copied' : 'insights.copy')}
    </Button>
    <span role="status" className="sr-only">{state === 'copied' ? t('insights.copyStatus') : ''}</span>
    {state === 'error' && <>
      <p role="alert" className="text-sm text-destructive">{t('insights.copyFailed')}</p>
      <textarea readOnly value={text} aria-label={t('insights.copyText')} className="h-48 w-full rounded-md border border-input bg-background p-3 text-sm" />
    </>}
  </div>
}
