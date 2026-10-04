import { useState, useDeferredValue } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Edit3,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { errorMessage } from '../../../shared/api/client'
import { formatPrice } from '../../menu/menu.api'
import {
  createFund,
  deleteFund,
  getFunds,
  updateFund,
  type Fund,
} from '../cashier-shifts.api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogHeader,
  DialogTitle,
  Input,
} from '../../../shared/ui'

const EMPTY_FUNDS: Fund[] = []

interface FundsTabProps {
  canManageFunds: boolean
  isCreateModalOpen: boolean
  setIsCreateModalOpen: (open: boolean) => void
  onError: (msg: string) => void
  onSuccess: (msg: string) => void
}

export function FundsTab({
  canManageFunds,
  isCreateModalOpen,
  setIsCreateModalOpen,
  onError,
  onSuccess,
}: FundsTabProps) {
  const queryClient = useQueryClient()

  const [fundKeyword, setFundKeyword] = useState('')
  const deferredFundKeyword = useDeferredValue(fundKeyword)
  const [fundTypeFilter, setFundTypeFilter] = useState<'ALL' | 'CASH' | 'BANK'>('ALL')

  const [selectedFund, setSelectedFund] = useState<Fund | null>(null)
  const [isEditFundModalOpen, setIsEditFundModalOpen] = useState(false)
  const [fundFormName, setFundFormName] = useState('')
  const [fundFormType, setFundFormType] = useState<'CASH' | 'BANK'>('CASH')
  const [fundFormOpeningBalance, setFundFormOpeningBalance] = useState('0')

  const fundsQuery = useQuery({
    queryKey: ['private', 'funds', deferredFundKeyword, fundTypeFilter],
    queryFn: ({ signal }) =>
      getFunds(
        {
          page: 1,
          itemPerPage: 50,
          keyword: deferredFundKeyword || undefined,
          type: fundTypeFilter === 'ALL' ? undefined : fundTypeFilter,
        },
        signal,
      ),
  })

  const fundsList = fundsQuery.data?.list ?? EMPTY_FUNDS

  const createFundMutation = useMutation({
    mutationFn: () =>
      createFund({
        name: fundFormName,
        type: fundFormType,
        openingBalance: fundFormOpeningBalance,
      }),
    onSuccess: () => {
      onSuccess('Tạo quỹ tiền mặt/ngân hàng mới thành công!')
      setIsCreateModalOpen(false)
      setFundFormName('')
      setFundFormOpeningBalance('0')
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const updateFundMutation = useMutation({
    mutationFn: () => {
      if (!selectedFund) throw new Error('Chưa chọn quỹ')
      return updateFund(selectedFund.id, { name: fundFormName, type: fundFormType })
    },
    onSuccess: () => {
      onSuccess('Cập nhật thông tin quỹ thành công!')
      setIsEditFundModalOpen(false)
      setSelectedFund(null)
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const deleteFundMutation = useMutation({
    mutationFn: (id: string) => deleteFund(id),
    onSuccess: () => {
      onSuccess('Đã xóa quỹ tiền an toàn!')
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={fundKeyword}
            onChange={(e) => setFundKeyword(e.target.value)}
            placeholder="Tìm kiếm theo tên quỹ..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={fundTypeFilter}
            onChange={(e) => setFundTypeFilter(e.target.value as 'ALL' | 'CASH' | 'BANK')}
            className="px-3 py-1.5 text-xs rounded-lg border border-input bg-background"
          >
            <option value="ALL">Tất cả loại quỹ</option>
            <option value="CASH">Tiền mặt tại quầy (CASH)</option>
            <option value="BANK">Tài khoản ngân hàng (BANK)</option>
          </select>
        </div>
      </div>

      {/* FUNDS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fundsQuery.isLoading ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            Đang tải danh mục quỹ tiền...
          </div>
        ) : fundsList.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            Không tìm thấy quỹ tiền mặt nào.
          </div>
        ) : (
          fundsList.map((fund) => {
            const isCash = fund.type === 'CASH'
            const canDelete = canManageFunds && Number(fund.balance) === 0

            return (
              <Card key={fund.id} className="relative overflow-hidden group hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isCash ? 'success' : 'outline'}>
                        {isCash ? 'Tiền mặt (CASH)' : 'Ngân hàng (BANK)'}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground mt-2">
                      {fund.name}
                    </CardTitle>
                  </div>

                  {canManageFunds && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFund(fund)
                          setFundFormName(fund.name)
                          setFundFormType(fund.type === 'BANK' ? 'BANK' : 'CASH')
                          setIsEditFundModalOpen(true)
                        }}
                        className="h-8 w-8 p-0"
                        title="Chỉnh sửa"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Bạn có chắc chắn muốn xóa quỹ "${fund.name}"?`)) {
                              deleteFundMutation.mutate(fund.id)
                            }
                          }}
                          className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                          title="Xóa quỹ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardHeader>

                <CardContent>
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground font-medium">Số dư khả dụng</span>
                    <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                      {formatPrice(fund.balance)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border mt-4 pt-3">
                    <span>Đã phát sinh: {fund._count?.shifts || 0} ca</span>
                    <span>{fund._count?.cashTransactions || 0} giao dịch</span>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* CREATE / EDIT FUND MODAL */}
      <Dialog
        open={isCreateModalOpen || isEditFundModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setIsEditFundModalOpen(false)
          setSelectedFund(null)
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditFundModalOpen ? 'Chỉnh sửa Quỹ tiền' : 'Thêm Quỹ tiền mặt mới'}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!fundFormName.trim()) {
              onError('Vui lòng nhập tên quỹ')
              return
            }
            if (isEditFundModalOpen) {
              updateFundMutation.mutate()
            } else {
              createFundMutation.mutate()
            }
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Tên định danh quỹ *</label>
            <Input
              value={fundFormName}
              onChange={(e) => setFundFormName(e.target.value)}
              placeholder="Ví dụ: Két sắt an toàn trung tâm..."
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Loại quỹ *</label>
            <select
              value={fundFormType}
              onChange={(e) => setFundFormType(e.target.value as 'CASH' | 'BANK')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background"
            >
              <option value="CASH">Tiền mặt tại quầy / Két an toàn (CASH)</option>
              <option value="BANK">Tài khoản Ngân hàng / Cổng điện tử (BANK)</option>
            </select>
          </div>

          {!isEditFundModalOpen && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Số dư khởi tạo ban đầu (VND)</label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={fundFormOpeningBalance}
                onChange={(e) => setFundFormOpeningBalance(e.target.value)}
                placeholder="0"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false)
                setIsEditFundModalOpen(false)
              }}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={createFundMutation.isPending || updateFundMutation.isPending}
            >
              {createFundMutation.isPending || updateFundMutation.isPending
                ? 'Đang lưu...'
                : isEditFundModalOpen
                  ? 'Cập nhật'
                  : 'Tạo quỹ'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
