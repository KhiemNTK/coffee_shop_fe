import { useId, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import {
  createPromotion,
  updatePromotion,
  deletePromotion,
  restorePromotion,
  getPromotionById,
  promotionKeys,
  promotionDecimalSchema,
  type Promotion,
  type DiscountType,
  type CreatePromotionPayload,
  type UpdatePromotionPayload,
} from '../promotions.api'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { formatPrice } from '../../../shared/lib/format'
import { fromStoreLocal, toStoreLocal, formatStoreDateTime } from '../../../shared/lib/store-time'
import { Button, Dialog, DialogHeader, DialogFooter, DialogTitle, Input } from '../../../shared/ui'

type ModalProps = {
  employeeId: string
  onClose: () => void
  onSuccess: () => void
  onSettled: () => void
}

function PromotionDetail({
  promotionId,
  employeeId,
  onClose,
  children,
}: Pick<ModalProps, 'employeeId' | 'onClose'> & {
  promotionId: string
  children: (promotion: Promotion, reload: () => void) => ReactNode
}) {
  const query = useQuery({
    queryKey: promotionKeys.detail(employeeId, promotionId),
    queryFn: ({ signal }) => getPromotionById(promotionId, signal),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  if (!query.isSuccess || query.isFetching)
    return (
      <Dialog open onClose={onClose}>
        <DialogTitle>Chi tiết khuyến mãi</DialogTitle>
        {query.isFetching ? (
          <p role="status">Đang tải trạng thái mới nhất…</p>
        ) : (
          <>
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(query.error)}
            </p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw size={16} aria-hidden="true" />
              Tải lại chương trình
            </Button>
          </>
        )}
      </Dialog>
    )
  return children(query.data, () => void query.refetch())
}

export function PromotionEditorModal(props: ModalProps & { promotionId?: string }) {
  return props.promotionId ? (
    <PromotionDetail {...props} promotionId={props.promotionId}>
      {(promotion, reload) =>
        promotion.deletedAt ? (
          <Dialog open onClose={props.onClose}>
            <DialogTitle>{promotion.name}</DialogTitle>
            <p role="status">Chương trình đã ngưng. Khôi phục trước khi sửa.</p>
          </Dialog>
        ) : (
          <PromotionEditor {...props} initial={promotion} onReload={reload} />
        )
      }
    </PromotionDetail>
  ) : (
    <PromotionEditor {...props} />
  )
}

function PromotionEditor({
  initial,
  onReload,
  ...props
}: ModalProps & { initial?: Promotion; onReload?: () => void }) {
  const id = useId()
  const errorRef = useRef<HTMLDivElement>(null)
  const flight = useRef(false)
  const [name, setName] = useState(initial?.name ?? '')
  const [discountType, setDiscountType] = useState<DiscountType>(
    initial?.discountType ?? 'PERCENTAGE',
  )
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? '10')
  const [maxDiscount, setMaxDiscount] = useState(initial?.maxDiscount ?? '')
  const [startDate, setStartDate] = useState(() =>
    toStoreLocal(initial ? new Date(initial.startDate) : new Date()),
  )
  const [endDate, setEndDate] = useState(() =>
    toStoreLocal(initial ? new Date(initial.endDate) : new Date(Date.now() + 30 * 86_400_000)),
  )
  const [validation, setValidation] = useState<{ field: string; message: string } | null>(null)
  const [blocked, setBlocked] = useState(false)
  const financialLocked = (initial?.usageCount ?? 0) > 0
  const mutation = useMutation({
    mutationFn: (payload: CreatePromotionPayload | UpdatePromotionPayload) =>
      initial
        ? updatePromotion(initial.id, payload)
        : createPromotion(payload as CreatePromotionPayload),
    retry: false,
    onSuccess: props.onSuccess,
    onError: (error) => {
      setBlocked(
        !(error instanceof ApiError) ||
          error.status >= 500 ||
          (error.status === 409 && Boolean(initial)) ||
          error.status === 408,
      )
      requestAnimationFrame(() => errorRef.current?.focus())
    },
    onSettled: () => {
      flight.current = false
      props.onSettled()
    },
  })
  function fail(field: string, message: string) {
    setValidation({ field, message })
    requestAnimationFrame(() => errorRef.current?.focus())
  }
  function inlineError(field: string) {
    return validation?.field === field ? (
      <p id={`${id}-${field}-error`} className="text-sm text-destructive">
        {validation.message}
      </p>
    ) : null
  }
  function close() {
    if (!flight.current) props.onClose()
  }
  const invalidProps = (field: string) => ({
    'aria-invalid': validation?.field === field || undefined,
    'aria-describedby': validation?.field === field ? `${id}-${field}-error` : undefined,
  })
  return (
    <Dialog open onClose={close}>
      <DialogHeader>
        <DialogTitle>
          {initial ? 'Cập nhật chương trình khuyến mãi' : 'Tạo chương trình khuyến mãi mới'}
        </DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (flight.current || blocked) return
          setValidation(null)
          if (!name.trim()) {
            fail('name', 'Vui lòng nhập tên chương trình.')
            return
          }
          let start: Date, end: Date
          try {
            start = fromStoreLocal(startDate)
            end = fromStoreLocal(endDate)
          } catch {
            fail('start', 'Ngày giờ chưa hợp lệ.')
            return
          }
          if (end <= start) {
            fail('end', 'Ngày kết thúc phải sau ngày bắt đầu.')
            return
          }
          const value = promotionDecimalSchema.safeParse(discountValue.trim())
          if (
            !value.success ||
            !/[1-9]/.test(value.data) ||
            (discountType === 'PERCENTAGE' && Number(value.data) > 100)
          ) {
            fail(
              'value',
              'Mức giảm phải lớn hơn 0, tối đa 2 chữ số thập phân; phần trăm không vượt 100%.',
            )
            return
          }
          const cap =
            discountType === 'PERCENTAGE'
              ? maxDiscount.trim() || null
              : initial?.discountType === 'FIXED_AMOUNT'
                ? (initial.maxDiscount ?? null)
                : null
          if (
            cap != null &&
            (!promotionDecimalSchema.safeParse(cap).success || !/[1-9]/.test(cap))
          ) {
            fail('cap', 'Giới hạn phải lớn hơn 0 và có tối đa 2 chữ số thập phân.')
            return
          }
          let payload: CreatePromotionPayload | UpdatePromotionPayload
          if (!initial)
            payload = {
              name: name.trim(),
              discountType,
              discountValue: value.data,
              maxDiscount: cap,
              startDate: start.toISOString(),
              endDate: end.toISOString(),
            }
          else {
            payload = {
              ...(name.trim() !== initial.name ? { name: name.trim() } : {}),
              ...(startDate !== toStoreLocal(new Date(initial.startDate))
                ? { startDate: start.toISOString() }
                : {}),
              ...(endDate !== toStoreLocal(new Date(initial.endDate))
                ? { endDate: end.toISOString() }
                : {}),
              ...(!financialLocked
                ? {
                    ...(discountType !== initial.discountType ? { discountType } : {}),
                    ...(value.data !== initial.discountValue ? { discountValue: value.data } : {}),
                    ...(cap !== (initial.maxDiscount ?? null) ? { maxDiscount: cap } : {}),
                  }
                : {}),
            }
            if (!Object.keys(payload).length) {
              props.onClose()
              return
            }
          }
          flight.current = true
          // ponytail: changed-field edits remain last-writer-wins; require server revisions for concurrent editing.
          mutation.mutate(payload)
        }}
      >
        {(validation || mutation.isError) && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">
            {validation ? (
              <a href={`#${id}-${validation.field}`}>{validation.message}</a>
            ) : (
              errorMessage(mutation.error)
            )}
          </div>
        )}
        {financialLocked && (
          <p className="border-l-4 border-primary pl-3 text-sm">
            Chương trình đã gắn vào {initial!.usageCount} hóa đơn. Mức giảm và giới hạn đã khóa.
          </p>
        )}
        <fieldset disabled={mutation.isPending || blocked} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor={`${id}-name`} className="text-sm font-medium">
              Tên chương trình
            </label>
            <Input
              id={`${id}-name`}
              {...invalidProps('name')}
              required
              maxLength={100}
              placeholder="Ví dụ: Khai xuân rộn ràng - Giảm 20%"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {inlineError('name')}
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-type`} className="text-sm font-medium">
              Hình thức giảm giá
            </label>
            <select
              id={`${id}-type`}
              disabled={financialLocked}
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value as DiscountType)}
              className="h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="PERCENTAGE">Theo phần trăm (%)</option>
              <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-value`} className="text-sm font-medium">
              {discountType === 'PERCENTAGE' ? 'Tỷ lệ giảm (%)' : 'Số tiền giảm (₫)'}
            </label>
            <Input
              id={`${id}-value`}
              {...invalidProps('value')}
              type="number"
              step="0.01"
              min="0.01"
              max={discountType === 'PERCENTAGE' ? 100 : undefined}
              required
              disabled={financialLocked}
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
            />
            {inlineError('value')}
          </div>
          {discountType === 'PERCENTAGE' && (
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor={`${id}-cap`} className="text-sm font-medium">
                Số tiền giảm tối đa (₫)
              </label>
              <Input
                id={`${id}-cap`}
                {...invalidProps('cap')}
                type="number"
                step="0.01"
                min="0.01"
                disabled={financialLocked}
                placeholder="Ví dụ: 50000 (để trống nếu không giới hạn)"
                value={maxDiscount}
                onChange={(event) => setMaxDiscount(event.target.value)}
              />
              {inlineError('cap')}
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor={`${id}-start`} className="text-sm font-medium">
              Ngày bắt đầu (Việt Nam)
            </label>
            <Input
              id={`${id}-start`}
              {...invalidProps('start')}
              type="datetime-local"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            {inlineError('start')}
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-end`} className="text-sm font-medium">
              Ngày kết thúc (Việt Nam)
            </label>
            <Input
              id={`${id}-end`}
              {...invalidProps('end')}
              type="datetime-local"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
            {inlineError('end')}
          </div>
        </fieldset>
        <p className="break-words border-t border-border pt-3 text-sm">
          {discountType === 'PERCENTAGE'
            ? `Giảm ${discountValue}%${maxDiscount ? ` (Tối đa ${formatPrice(maxDiscount)})` : ''}`
            : `Giảm ${formatPrice(discountValue)}`}
        </p>
        {blocked && (
          <div className="space-y-2 text-sm">
            <p>
              {initial
                ? 'Đối chiếu chương trình mới nhất trước khi sửa tiếp.'
                : 'Chưa rõ kết quả tạo. Đối chiếu danh sách theo tên trước khi tạo chương trình khác.'}
            </p>
            {onReload && (
              <Button type="button" variant="outline" onClick={onReload}>
                <RefreshCw size={16} aria-hidden="true" />
                Đối chiếu chương trình
              </Button>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>
            Đóng
          </Button>
          <Button type="submit" disabled={mutation.isPending || blocked}>
            {mutation.isPending
              ? 'Đang lưu…'
              : initial
                ? 'Lưu thay đổi'
                : 'Xác nhận tạo khuyến mãi'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export function PromotionCommandModal(
  props: ModalProps & { promotionId: string; kind: 'delete' | 'restore' },
) {
  return (
    <PromotionDetail {...props}>
      {(promotion, reload) => (
        <PromotionCommand {...props} promotion={promotion} onReload={reload} />
      )}
    </PromotionDetail>
  )
}

function PromotionCommand({
  promotion,
  kind,
  onReload,
  ...props
}: ModalProps & {
  promotionId: string
  promotion: Promotion
  kind: 'delete' | 'restore'
  onReload: () => void
}) {
  const errorRef = useRef<HTMLParagraphElement>(null)
  const flight = useRef(false)
  const [blocked, setBlocked] = useState(false)
  const mutation = useMutation({
    mutationFn: async () => {
      await (kind === 'delete' ? deletePromotion(promotion.id) : restorePromotion(promotion.id))
    },
    retry: false,
    onSuccess: props.onSuccess,
    onError: (error) => {
      setBlocked(
        !(error instanceof ApiError) ||
          error.status >= 500 ||
          error.status === 409 ||
          error.status === 408,
      )
      requestAnimationFrame(() => errorRef.current?.focus())
    },
    onSettled: () => {
      flight.current = false
      props.onSettled()
    },
  })
  const alreadyDone = kind === 'delete' ? Boolean(promotion.deletedAt) : !promotion.deletedAt
  function close() {
    if (!flight.current) props.onClose()
  }
  return (
    <Dialog open onClose={close}>
      <DialogHeader>
        <DialogTitle>
          {kind === 'delete' ? 'Ngừng áp dụng khuyến mãi?' : 'Khôi phục khuyến mãi?'}
        </DialogTitle>
      </DialogHeader>
      <p className="break-words font-medium">{promotion.name}</p>
      <p className="text-sm">
        {formatStoreDateTime(promotion.startDate)} – {formatStoreDateTime(promotion.endDate)}
      </p>
      <p className="text-sm">Đã gắn vào {promotion.usageCount} hóa đơn.</p>
      {kind === 'delete' ? (
        <p className="text-sm">
          Hóa đơn cũ giữ nguyên. Chương trình sẽ không áp dụng cho hóa đơn mới.
        </p>
      ) : (
        <p className="text-sm">
          Khôi phục giữ nguyên thời gian hiệu lực; không tự gia hạn chương trình đã hết hạn.
        </p>
      )}
      {alreadyDone && <p role="status">Thao tác đã hoàn tất theo trạng thái hiện tại.</p>}
      {mutation.isError && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">
          {errorMessage(mutation.error)}
        </p>
      )}
      {blocked && (
        <Button variant="outline" onClick={onReload}>
          <RefreshCw size={16} aria-hidden="true" />
          Đối chiếu trạng thái
        </Button>
      )}
      <DialogFooter>
        <Button variant="outline" disabled={mutation.isPending} onClick={close}>
          Đóng
        </Button>
        {!alreadyDone && (
          <Button
            variant={kind === 'delete' ? 'destructive' : 'default'}
            disabled={mutation.isPending || blocked}
            onClick={() => {
              if (flight.current || blocked) return
              flight.current = true
              mutation.mutate()
            }}
          >
            {kind === 'delete' ? (
              <Trash2 size={16} aria-hidden="true" />
            ) : (
              <RotateCcw size={16} aria-hidden="true" />
            )}
            {mutation.isPending
              ? 'Đang xử lý…'
              : kind === 'delete'
                ? 'Xác nhận ngừng áp dụng'
                : 'Xác nhận khôi phục'}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  )
}
