import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'

export function Pagination({ page, totalPages, onPage, disabled = false }: {
  page: number; totalPages: number; onPage: (page: number) => void; disabled?: boolean
}) {
  return <nav aria-label="Phân trang" className="flex items-center justify-end gap-3 py-3">
    <Button type="button" variant="outline" size="sm" aria-label="Trang trước" disabled={disabled || page <= 1}
      onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
    <span className="text-sm">{page} / {Math.max(1, totalPages)}</span>
    <Button type="button" variant="outline" size="sm" aria-label="Trang sau" disabled={disabled || page >= totalPages}
      onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
  </nav>
}
