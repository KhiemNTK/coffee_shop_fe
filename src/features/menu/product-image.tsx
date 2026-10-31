import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageOff } from 'lucide-react'
import type { MenuItem } from '@/features/menu/menu.api'
import { cn } from '@/shared/ui/utils'

export function ProductImage({ item, className }: {
  item: Pick<MenuItem, 'name' | 'imageUrl'>
  className?: string
}) {
  const { t } = useTranslation()
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!item.imageUrl || failedUrl === item.imageUrl)
    return (
      <div role="img" aria-label={t('storefront.imageMissing', { name: item.name })}
        className={cn('flex h-full w-full items-center justify-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="size-6" aria-hidden="true" />
      </div>
    )
  return (
    <img key={item.imageUrl} src={item.imageUrl} alt={item.name} loading="lazy" decoding="async"
      referrerPolicy="no-referrer" className={cn('h-full w-full object-cover', className)}
      onError={() => setFailedUrl(item.imageUrl!)} />
  )
}
