import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react'
import { getTelegramLink } from '../online-orders.api'
import { errorMessage } from '../../../shared/api/client'
import { Button } from '../../../shared/ui/button'
import { buttonVariants } from '../../../shared/ui/button-variants'

export function TelegramOrderLink({
  requestId,
  accessToken,
  subscribed,
}: {
  requestId: string
  accessToken: string
  subscribed: boolean
}) {
  const submitting = useRef(false)
  const [expiredAt, setExpiredAt] = useState('')
  const mutation = useMutation({
    mutationFn: () => getTelegramLink(requestId, accessToken),
    gcTime: 0,
    retry: false,
    onSuccess: (data) => {
      setExpiredAt(Date.parse(data.expiresAt) <= Date.now() ? data.expiresAt : '')
    },
    onSettled: () => {
      submitting.current = false
    },
  })
  const link = mutation.data
  useEffect(() => {
    if (!link) return
    const timer = window.setTimeout(
      () => setExpiredAt(link.expiresAt),
      Math.max(0, Date.parse(link.expiresAt) - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [link])

  if (subscribed)
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-emerald-700"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Đã kết nối Telegram
      </p>
    )
  const validLink = link && link.expiresAt !== expiredAt
  return (
    <div className="space-y-2">
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(mutation.error)}
        </p>
      )}
      {validLink ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          onClick={(event) => {
            if (Date.parse(link.expiresAt) <= Date.now()) {
              event.preventDefault()
              setExpiredAt(link.expiresAt)
            }
          }}
          className={buttonVariants({
            variant: 'outline',
            className: 'w-full gap-2',
          })}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Mở Telegram
        </a>
      ) : (
        <>
          {link && (
            <p role="status" className="text-sm text-muted-foreground">
              Liên kết Telegram đã hết hạn.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            isLoading={mutation.isPending}
            className="w-full gap-2"
            onClick={() => {
              if (submitting.current) return
              submitting.current = true
              mutation.mutate()
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Nhận cập nhật qua Telegram
          </Button>
        </>
      )}
    </div>
  )
}
