import { Pencil, Plus, Trash2 } from 'lucide-react'
import { type UseQueryResult } from '@tanstack/react-query'
import { type AdminCategoriesResponse, type AdminCategory } from '../menu.admin.api'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Button } from '../../../shared/ui/button'

interface CategoriesTabProps {
  categoriesQuery: UseQueryResult<AdminCategoriesResponse, Error>
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  onCreateClick: () => void
  onEditClick: (cat: AdminCategory) => void
  onDeleteClick: (cat: AdminCategory) => void
}

export function CategoriesTab({
  categoriesQuery,
  canCreate,
  canUpdate,
  canDelete,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: CategoriesTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold text-foreground">
            Danh mục món ăn & đồ uống
          </CardTitle>
          {canCreate && (
            <Button
              size="sm"
              onClick={onCreateClick}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Thêm danh mục
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Tên danh mục</th>
                  <th className="px-4 py-3">Mô tả</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categoriesQuery.data?.list.map((cat) => (
                  <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-foreground">{cat.name}</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {cat.description || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditClick(cat)}
                            className="h-8 w-8 p-0"
                            title="Sửa danh mục"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteClick(cat)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Xóa danh mục"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!categoriesQuery.data?.list.length && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Chưa có danh mục nào. Hãy tạo danh mục đầu tiên!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
