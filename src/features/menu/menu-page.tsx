import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Coffee,
  RotateCw,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react'
import {
  formatPrice,
  getCategories,
  getMenu,
  type MenuFilters,
  type MenuItem,
} from './menu.api'
import { hasAuthSession } from '../../shared/api/client'
import { useSession } from '../auth/session'
import { Card, CardHeader, CardTitle, CardContent } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { buttonVariants } from '../../shared/ui/button-variants'
import { Badge } from '../../shared/ui/badge'
import { Input } from '../../shared/ui/input'
import { cn } from '../../shared/ui/utils'

const initialFilters: MenuFilters = { keyword: '', categoryId: '', page: 1 }

function MenuCard({ item }: { item: MenuItem }) {
  return (
    <article className="h-full">
      <Card className="flex flex-col justify-between overflow-hidden transition-all hover:border-primary/50 hover:shadow-md h-full">
        <CardHeader className="p-4 pb-2">
          <Badge variant="secondary" className="w-fit text-[11px] mb-1.5">
            {item.category.name}
          </Badge>
          <CardTitle className="text-base font-bold text-foreground line-clamp-2">
            {item.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-lg font-bold text-primary">{formatPrice(item.price)}</p>

          {item.optionGroups.length > 0 && (
            <details className="mt-3 rounded-lg border border-border bg-muted/20 p-2.5 text-xs group">
              <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground select-none">
                Tùy chọn món ({item.optionGroups.length})
              </summary>
              <div className="mt-2 space-y-2 pt-2 border-t border-border">
                {item.optionGroups.map((group) => (
                  <div key={group.id} className="space-y-1">
                    <strong className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                      {group.name}
                    </strong>
                    <ul className="space-y-1">
                      {group.options.map((option) => (
                        <li key={option.id} className="flex justify-between text-muted-foreground">
                          <span>{option.name}</span>
                          <span className="font-semibold text-primary">+{formatPrice(option.priceDelta)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    </article>
  )
}

export function MenuPage() {
  const [draft, setDraft] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const session = useSession(hasAuthSession())
  const employee = session.data?.employee
  const categories = useQuery({
    queryKey: ['public-menu', 'categories'],
    queryFn: ({ signal }) => getCategories(signal),
  })
  const menu = useQuery({
    queryKey: ['public-menu', 'items', filters],
    queryFn: ({ signal }) => getMenu(filters, signal),
  })
  const filtered = Boolean(filters.keyword || filters.categoryId)
  function resetFilters() {
    setDraft('')
    setFilters(initialFilters)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <a className="flex items-center gap-2 text-lg font-bold text-primary" href="/">
            <Coffee className="h-6 w-6" />
            Coffee Shop
          </a>
          <nav className="flex items-center gap-3" aria-label="Chính">
            <a
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
              href="#menu"
            >
              Thực đơn
            </a>
            <Link
              to="/reservations"
              className="text-sm font-semibold text-muted-foreground hover:text-emerald-800 transition-colors hidden sm:inline"
            >
              Đặt bàn trước
            </Link>
            <Link
              to="/order"
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 shadow-sm font-semibold')}
            >
              <ShoppingBag className="h-4 w-4" />
              Đặt mang đi
            </Link>
            {employee ? (
              <Link
                to="/staff"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/10 transition-colors',
                )}
                title={`Đang đăng nhập: ${employee.fullName}`}
              >
                <UserRound className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline font-semibold">{employee.fullName}</span>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                  {employee.position?.name || 'Vào ca'}
                </span>
              </Link>
            ) : (
              <Link
                to="/sign-in"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-muted-foreground')}
              >
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">Nhân viên</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Cover */}
      <section className="relative overflow-hidden bg-primary text-white py-16 sm:py-24" aria-labelledby="page-title">
        <div className="menu-cover absolute inset-0 z-0">
          <img
            src="/menu-cover.jpg"
            alt="Không gian quán"
            className="w-full h-full object-cover opacity-25"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/75 z-10" />
        <div className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">COFFEE SHOP</p>
          <h1 id="page-title" className="mt-2 text-3xl font-extrabold sm:text-5xl tracking-tight">
            Thực đơn đồ uống & Bánh
          </h1>
          <p className="mt-3 max-w-xl text-sm sm:text-base text-emerald-100">
            Trải nghiệm hương vị cà phê mộc đậm đà nguyên bản và thức uống tươi ngon mỗi ngày.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/order"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-lg hover:bg-emerald-50 transition-all active:scale-95"
            >
              <ShoppingBag className="h-4 w-4" />
              Đặt mang đi ngay
            </Link>
            <Link
              to="/reservations"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all active:scale-95"
            >
              <CalendarDays className="h-4 w-4" />
              Đặt bàn trước
            </Link>
            <a
              href="#menu"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors"
            >
              Xem thực đơn &darr;
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12" id="menu">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">HÔM NAY UỐNG GÌ?</p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Chọn vị bạn thích</h2>
          </div>

          <form
            className="flex items-center gap-2 w-full sm:w-auto"
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              setFilters((current) => ({
                ...current,
                keyword: draft.trim(),
                page: 1,
              }))
            }}
          >
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Tìm món"
                placeholder="Tìm món bạn thích…"
                maxLength={120}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit">Tìm</Button>
          </form>
        </div>

        {/* Categories failure retry */}
        {categories.isError && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
            <span>Chưa tải được danh mục món.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void categories.refetch()}
              className="h-7 text-xs"
            >
              Thử lại danh mục
            </Button>
          </div>
        )}

        {/* Categories Pills */}
        <nav className="flex flex-wrap gap-2 mb-6" aria-label="Danh mục món">
          <button
            type="button"
            aria-pressed={!filters.categoryId}
            onClick={() => setFilters((current) => ({ ...current, categoryId: '', page: 1 }))}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
              !filters.categoryId
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            Tất cả
          </button>
          {categories.data?.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={filters.categoryId === category.id}
              onClick={() => setFilters((current) => ({ ...current, categoryId: category.id, page: 1 }))}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                filters.categoryId === category.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              {category.name}
            </button>
          ))}
        </nav>

        {/* Status / Results Count */}
        <div className="flex items-center justify-between border-b border-border pb-3 mb-6">
          <span className="text-sm font-semibold text-muted-foreground" role="status">
            {menu.data ? `Có ${menu.data.totalItems} món` : 'Đang tải…'}
          </span>
          {filtered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {/* Menu Items Grid or States */}
        <section aria-label="Danh sách món">
          {menu.isError ? (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive"
              role="alert"
            >
              <p className="font-semibold">Chưa tải được thực đơn.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void menu.refetch()}
                className="mt-3 gap-1.5"
              >
                <RotateCw className="h-4 w-4" />
                Thử lại
              </Button>
            </div>
          ) : menu.isPending ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="h-44 rounded-xl border border-border bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : menu.data.list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
              <h3 className="text-base font-bold text-foreground">
                {filters.page > 1
                  ? 'Không còn món trên trang này'
                  : filtered
                    ? 'Không tìm thấy món phù hợp'
                    : 'Thực đơn đang được cập nhật'}
              </h3>
              {filters.page > 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters((c) => ({ ...c, page: 1 }))}
                  className="mt-4"
                >
                  Về trang đầu
                </Button>
              ) : filtered ? (
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                  Xóa bộ lọc
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {menu.data.list.map((item) => (
                <MenuCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        {/* Pagination */}
        {!menu.isError && menu.data && menu.data.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={filters.page <= 1 || menu.isFetching}
              onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              className="h-8 gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Trang trước
            </Button>
            <span className="text-xs font-semibold text-muted-foreground">
              Trang {menu.data.currentPage} / {menu.data.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={filters.page >= menu.data.totalPages || menu.isFetching}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              className="h-8 gap-1.5"
            >
              Trang sau
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card py-8 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-1.5">
          <Coffee className="h-4 w-4 text-primary" />
          <span>© 2026 Coffee Shop. Tất cả các quyền được bảo lưu.</span>
        </div>
      </footer>
    </div>
  )
}
