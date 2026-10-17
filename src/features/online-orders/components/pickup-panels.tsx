import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Copy, QrCode, RefreshCw, RotateCw, Ban, Check } from 'lucide-react'
import type { Session } from '../../auth/session'
import { Button, Input } from '../../../shared/ui'
import { PaymentQr } from '../../../shared/ui/payment-qr'
import { errorMessage } from '../../../shared/api/client'
import { onlineOrderKeys } from '../online-orders.api'
import { kitchenKeys } from '../../kitchen/kitchen.api'
import {
  collectPickupItem,
  getPickupStatus,
  issuePickupCode,
  parsePickupLink,
  pickupLink,
  revokePickupCode,
  rotatePickupCode,
  type PickupCredential,
} from '../pickup.api'

export function PickupCodePanel({ invoiceId }: { invoiceId: string }) {
  const { t: translate } = useTranslation()
  const { authorization } = useOutletContext<Session>()
  const [issued, setIssued] = useState<(PickupCredential & { expiresAt: string }) | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const canChange = authorization.permissionKeys.includes('/invoices_update')
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async (action: 'issue' | 'rotate' | 'revoke') => {
      if (action === 'revoke') {
        await revokePickupCode(issued!)
        return null
      }
      return action === 'rotate' ? rotatePickupCode(issued!) : issuePickupCode(invoiceId)
    },
    onSuccess: (value) => {
      setIssued(value)
      setCopied(false)
      setCopyError(false)
    },
    onError: () => {
      setIssued(null)
    },
  })
  return (
    <section
      aria-label={translate('takeaway.pickupCode')}
      className="space-y-3 border-b border-border px-5 py-4"
    >
      <h4 className="font-semibold">{translate('takeaway.pickupCode')}</h4>
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(mutation.error)}
        </p>
      )}
      {!issued ? (
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate('issue')}
        >
          <QrCode size={16} />
          {translate('takeaway.getPickupLink')}
        </Button>
      ) : (
        <>
          <PaymentQr value={pickupLink(issued)} label={translate('takeaway.pickupQr')} />
          <p className="text-sm">
            {translate('takeaway.expires')} {new Date(issued.expiresAt).toLocaleString('vi-VN')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                void navigator.clipboard
                  .writeText(pickupLink(issued))
                  .then(() => setCopied(true))
                  .catch(() => setCopyError(true))
              }}
            >
              <Copy size={16} />
              {copied ? translate('takeaway.copiedShort') : translate('takeaway.copyLink')}
            </Button>
            {canChange && (
              <>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (window.confirm(translate('takeaway.rotateCodeInfo')))
                      mutation.mutate('rotate')
                  }}
                >
                  <RotateCw size={16} />
                  {translate('takeaway.rotateCode')}
                </Button>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (window.confirm(translate('takeaway.revokePickupInfo')))
                      mutation.mutate('revoke')
                  }}
                >
                  <Ban size={16} />
                  {translate('takeaway.revoke')}
                </Button>
              </>
            )}
          </div>
          {copyError && <p role="alert">{translate('takeaway.copyLinkFailed')}</p>}
        </>
      )}
    </section>
  )
}

export function PickupCollectionPanel() {
  const { t: translate } = useTranslation()
  const { employee } = useOutletContext<Session>()
  const [value, setValue] = useState('')
  const [credential, setCredential] = useState<PickupCredential | null>(null)
  const [verification, setVerification] = useState(0)
  const [invalid, setInvalid] = useState(false)
  const client = useQueryClient()
  const status = useQuery({
    queryKey: ['private', employee.id, 'pickup-collection', credential?.invoiceId, verification],
    enabled: Boolean(credential),
    staleTime: 0,
    gcTime: 0,
    queryFn: ({ signal }) => getPickupStatus(credential!, signal),
  })
  const collect = useMutation({
    mutationFn: (id: string) => collectPickupItem(credential!, id),
    onSettled: () => {
      void status.refetch()
      void client.invalidateQueries({ queryKey: onlineOrderKeys.all(employee.id) })
      void client.invalidateQueries({ queryKey: kitchenKeys.all(employee.id) })
    },
  })
  return (
    <section
      aria-label={translate('takeaway.handoffCode')}
      className="space-y-3 border-y border-border bg-card px-4 py-4"
    >
      <h2 className="text-sm font-semibold">{translate('takeaway.handoffCode')}</h2>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const parsed = parsePickupLink(value)
          setInvalid(!parsed)
          if (parsed) {
            setCredential(parsed)
            setVerification((value) => value + 1)
            collect.reset()
          }
        }}
      >
        <Input
          aria-label={translate('takeaway.pickupLink')}
          type="password"
          placeholder={translate('takeaway.pickupLink')}
          autoComplete="off"
          value={value}
          disabled={collect.isPending}
          onChange={(event) => {
            setValue(event.target.value)
            setCredential(null)
            collect.reset()
          }}
          className="min-h-11 min-w-0 flex-1"
        />
        <Button type="submit" className="min-h-11" disabled={!value.trim() || collect.isPending}>
          <QrCode size={16} aria-hidden="true" />
          {translate('takeaway.check')}
        </Button>
      </form>
      {invalid && <p role="alert">{translate('takeaway.invalidLink')}</p>}
      {status.isFetching && <p role="status">{translate('takeaway.checking')}</p>}
      {status.isError && <p role="alert">{errorMessage(status.error)}</p>}
      {collect.isError && (
        <p role="alert">
          {errorMessage(collect.error)} {translate('takeaway.reviewHandoff')}
        </p>
      )}
      {credential && status.data && !status.isError && (
        <>
          <Button
            variant="outline"
            disabled={status.isFetching || collect.isPending}
            onClick={() => {
              collect.reset()
              void status.refetch()
            }}
          >
            <RefreshCw size={16} />
            {translate('takeaway.checkAgain')}
          </Button>
          <ul className="divide-y divide-border">
            {status.data.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {item.quantity} × {item.name}
                </span>
                {item.serveStatus === 'SERVED' ? (
                  <span>{translate('takeaway.received')}</span>
                ) : (
                  <Button
                    size="sm"
                    disabled={
                      item.serveStatus !== 'READY' ||
                      collect.isPending ||
                      status.isFetching ||
                      collect.isError
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          translate('takeaway.handoffAll') +
                            item.quantity +
                            ' × ' +
                            item.name +
                            '?',
                        )
                      )
                        collect.mutate(item.id)
                    }}
                  >
                    <Check size={16} />
                    {translate('takeaway.handoff')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
