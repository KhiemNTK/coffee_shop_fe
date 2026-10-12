import { useTranslation } from 'react-i18next'
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
  getPublicStore,
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
  const { t: translate } = useTranslation()
  return (
    <article className="h-full">
      <Card className="flex flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md h-full">
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="aspect-[4/3] w-full object-cover"
            onError={(event) => {
              event.currentTarget.hidden = true
            }}
          />
        )}
        <CardHeader className="p-4 pb-2">
          <Badge
            variant="secondary"
            className="w-fit max-w-full truncate text-[11px] mb-1.5 font-medium"
            title={item.category.name}
          >
            {item.category.name}
          </Badge>
          <CardTitle
            className="text-base font-bold text-foreground line-clamp-2 break-words leading-snug"
            title={item.name}
          >
            {item.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {item.description && (
            <p className="mb-3 text-sm text-muted-foreground break-words">{item.description}</p>
          )}
          <p className="text-lg font-bold text-primary tabular-nums tracking-tight">
            {formatPrice(item.price)}
          </p>

          {item.optionGroups.length > 0 && (
            <details className="mt-3 rounded-lg border border-border bg-muted/20 p-2.5 text-xs group">
              <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground select-none transition-colors">
                {translate('menu.optionsCount', { count: item.optionGroups.length })}
              </summary>
              <div className="mt-2 space-y-2 pt-2 border-t border-border">
                {item.optionGroups.map((group) => (
                  <div key={group.id} className="space-y-1 min-w-0">
                    <strong
                      className="block text-[11px] uppercase tracking-wider text-muted-foreground truncate"
                      title={group.name}
                    >
                      {group.name}
                    </strong>
                    <ul className="space-y-1">
                      {group.options.map((option) => (
                        <li
                          key={option.id}
                          className="flex items-baseline justify-between gap-2 min-w-0 text-muted-foreground"
                        >
                          <span
                            className="min-w-0 flex-1 break-words line-clamp-1"
                            title={option.name}
                          >
                            {option.name}
                          </span>
                          <span className="shrink-0 font-semibold text-primary tabular-nums">
                            +{formatPrice(option.priceDelta)}
                          </span>
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
  const { t: translate } = useTranslation()
  const [copyrightYear] = useState(() => new Date().getFullYear())
  const [draft, setDraft] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const session = useSession(hasAuthSession())
  const employee = session.data?.employee
  const store = useQuery({
    queryKey: ['public-store'],
    queryFn: ({ signal }) => getPublicStore(signal),
  })
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
            <span className="min-w-0 break-words">{store.data?.name ?? 'Coffee Shop'}</span>
          </a>
          <nav className="flex items-center gap-3" aria-label={translate('menu.mainNav')}>
            <a
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
              href="#menu"
            >
              {translate('nav.menu')}
            </a>
            <Link
              to="/reservations"
              className="text-sm font-semibold text-muted-foreground hover:text-emerald-800 transition-colors hidden sm:inline"
            >
              {translate('menu.reserve')}
            </Link>
            <Link
              to="/order"
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 shadow-sm font-semibold')}
            >
              <ShoppingBag className="h-4 w-4" />
              {translate('menu.takeaway')}
            </Link>
            {employee ? (
              <Link
                to="/staff"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/10 transition-colors',
                )}
                title={employee.fullName}
              >
                <UserRound className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline font-semibold">{employee.fullName}</span>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                  {employee.position?.name || translate('menu.startShift')}
                </span>
              </Link>
            ) : (
              <Link
                to="/sign-in"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'gap-1.5 text-muted-foreground',
                )}
              >
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">{translate('common.staff')}</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Cover */}
      <section
        className="relative overflow-hidden bg-primary text-white py-16 sm:py-24"
        aria-labelledby="page-title"
      >
        <div className="menu-cover absolute inset-0 z-0">
          <img
            src="/menu-cover.jpg"
            alt={translate('menu.shopImage')}
            className="w-full h-full object-cover opacity-25"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/75 z-10" />
        <div className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
            {store.data?.name ?? 'Coffee Shop'}
          </p>
          <h1 id="page-title" className="mt-2 text-3xl font-extrabold sm:text-5xl tracking-tight">
            {translate('menu.heading')}
          </h1>
          <p className="mt-3 max-w-xl text-sm sm:text-base text-emerald-100">
            {translate('menu.description')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/order"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-lg hover:bg-emerald-50 transition-all active:scale-95"
            >
              <ShoppingBag className="h-4 w-4" />
              {translate('menu.orderNow')}
            </Link>
            <Link
              to="/reservations"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all active:scale-95"
            >
              <CalendarDays className="h-4 w-4" />
              {translate('menu.reserve')}
            </Link>
            <a
              href="#menu"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors"
            >
              {translate('menu.viewMenu')}
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12" id="menu">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {translate('menu.today')}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {translate('menu.choose')}
            </h2>
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
                aria-label={translate('menu.searchLabel')}
                placeholder={translate('menu.searchPlaceholder')}
                maxLength={120}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit">{translate('common.search')}</Button>
          </form>
        </div>

        {/* Categories failure retry */}
        {categories.isError && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
            <span>{translate('menu.categoriesFailed')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void categories.refetch()}
              className="h-7 text-xs"
            >
              {translate('menu.retryCategories')}
            </Button>
          </div>
        )}

        {/* Categories Pills */}
        <nav className="flex flex-wrap gap-2 mb-6" aria-label={translate('menu.categoryNav')}>
          <button
            type="button"
            aria-pressed={!filters.categoryId}
            onClick={() => setFilters((current) => ({ ...current, categoryId: '', page: 1 }))}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer select-none',
              !filters.categoryId
                ? 'bg-primary text-primary-foreground shadow-xs ring-1 ring-primary'
                : 'border border-border bg-card text-foreground hover:bg-muted hover:border-border/90',
            )}
          >
            {translate('common.all')}
          </button>
          {categories.data?.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={filters.categoryId === category.id}
              onClick={() =>
                setFilters((current) => ({ ...current, categoryId: category.id, page: 1 }))
              }
              className={cn(
                'rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer select-none',
                filters.categoryId === category.id
                  ? 'bg-primary text-primary-foreground shadow-xs ring-1 ring-primary'
                  : 'border border-border bg-card text-foreground hover:bg-muted hover:border-border/90',
              )}
            >
              {category.name}
            </button>
          ))}
        </nav>

        {/* Status / Results Count */}
        <div className="flex items-center justify-between border-b border-border pb-3 mb-6">
          <span className="text-sm font-semibold text-muted-foreground" role="status">
            {menu.data
              ? translate('menu.count', { count: menu.data.totalItems })
              : translate('common.loading')}
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
              {translate('common.clearFilters')}
            </Button>
          )}
        </div>

        {/* Menu Items Grid or States */}
        <section aria-label={translate('menu.list')}>
          {menu.isError ? (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive"
              role="alert"
            >
              <p className="font-semibold">{translate('menu.failed')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void menu.refetch()}
                className="mt-3 gap-1.5"
              >
                <RotateCw className="h-4 w-4" />
                {translate('common.retry')}
              </Button>
            </div>
          ) : menu.isPending ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="h-44 rounded-xl border border-border bg-muted/30 animate-pulse"
                />
              ))}
            </div>
          ) : menu.data.list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
              <h3 className="text-base font-bold text-foreground">
                {filters.page > 1
                  ? translate('menu.pageEmpty')
                  : filtered
                    ? translate('menu.noMatches')
                    : translate('menu.updating')}
              </h3>
              {filters.page > 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters((c) => ({ ...c, page: 1 }))}
                  className="mt-4"
                >
                  {translate('common.firstPage')}
                </Button>
              ) : filtered ? (
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                  {translate('common.clearFilters')}
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
              {translate('common.previousPage')}
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
              {translate('common.nextPage')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card py-8 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-1.5">
          <Coffee className="h-4 w-4 text-primary" />
          <span>{translate('menu.footer', { year: copyrightYear })}</span>
        </div>
      </footer>
    </div>
  )
}
