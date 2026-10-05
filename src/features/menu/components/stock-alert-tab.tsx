import { type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { type ItemStockStatusResponse } from '../menu.admin.api'
import { errorMessage } from '../../../shared/api/client'
import { Button, Input, Badge } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'

export function StockAlertTab({ stockStatusQuery: query, keyword, onKeywordChange, page, onPageChange, canUpdate, toggleMutation }: {
  stockStatusQuery: UseQueryResult<ItemStockStatusResponse, Error>
  keyword: string; onKeywordChange: (value: string) => void; page: number; onPageChange: (value: number) => void
  canUpdate: boolean; toggleMutation: UseMutationResult<unknown, Error, { id: string; isAvailable: boolean }>
}) {
  return <section aria-label="Nguyên liệu theo món" className="space-y-4">
    <Input aria-label="Tìm món theo nguyên liệu" placeholder="Tìm tên món…" maxLength={120} value={keyword}
      onChange={event => { onKeywordChange(event.target.value); onPageChange(1) }} />
    {query.isError ? <div><p role="alert" className="text-destructive">{errorMessage(query.error)}</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Tải lại tồn nguyên liệu</Button></div>
      : query.isPending ? <p role="status">Đang tải tồn nguyên liệu…</p> : <>
        <h2 className="text-base font-semibold">Món theo bộ lọc ({query.data.totalItems})</h2>
        <p className="text-sm text-muted-foreground">Công thức gốc cho một suất, chưa gồm topping và đơn chưa chế biến.</p>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-y bg-muted"><tr><th className="p-3">Món</th><th className="p-3">Nguyên liệu</th>
              <th className="p-3">Thành phần cần lưu ý</th><th className="p-3">Trạng thái bán</th><th className="p-3">Thao tác</th></tr></thead>
            <tbody className="divide-y">{query.data.list.map(item => <tr key={item.id}>
              <td className="p-3 font-medium">{item.name}</td>
              <td className="p-3"><Badge variant={item.stockStatus === 'INSUFFICIENT' ? 'destructive' : item.stockStatus === 'OK' ? 'success' : 'secondary'}>
                {{ INSUFFICIENT: 'Không đủ một suất', LOW: 'Chạm ngưỡng nhập lại', OK: 'Đủ một suất', UNTRACKED: 'Chưa có công thức' }[item.stockStatus]}
              </Badge></td>
              <td className="p-3">{item.atRiskIngredients.map(ingredient => ingredient.name).join(', ') || '—'}</td>
              <td className="p-3">{item.isAvailable ? 'Đang bán' : 'Ngừng bán'}</td>
              <td className="p-3">{canUpdate && item.isAvailable && (item.stockStatus === 'LOW' || item.stockStatus === 'INSUFFICIENT') &&
                <Button size="sm" variant="outline" disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ id: item.id, isAvailable: false })}>Ngừng bán</Button>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!query.data.list.length && <p>Không có món trong trang này.</p>}
        {(query.data.totalPages > 1 || page > 1) && <Pagination page={page} totalPages={query.data.totalPages} disabled={query.isFetching} onPage={onPageChange} />}
        {page > Math.max(1, query.data.totalPages) && <Button variant="outline" onClick={() => onPageChange(1)}>Về trang đầu</Button>}
      </>}
  </section>
}
