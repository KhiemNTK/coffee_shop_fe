import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, RotateCw, Search, X } from 'lucide-react'
import { getCategories, getMenu, getPublicStore, type MenuFilters, type MenuItem } from './menu.api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/ui/utils'
import { SiteHeader } from '@/shared/components/site-header'
import { ProductDetailModal } from './components/product-detail-modal'
import { CartCheckoutDrawer } from '../online-orders/components/cart-checkout-drawer'
import { OrderTrackingView } from '../online-orders/components/order-tracking-view'
import { useCart, type CartItem } from '../online-orders/cart'
import { rememberOrder, type OrderAccess } from '../online-orders/order-access-storage'

// Modular Storefront Components
import { MenuHero } from './components/menu-hero'
import { TrustBadgesStrip } from './components/trust-badges-strip'
import { FeaturedCategories } from './components/featured-categories'
import { BestsellersShelf } from './components/bestsellers-shelf'
import { MenuCatalogSidebar } from './components/menu-catalog-sidebar'
import { MenuCard } from './components/menu-card'
import { StoreFooter } from './components/store-footer'
import { StorefrontPromotion } from '../promotions/storefront-promotion'

const initialFilters: MenuFilters = {
  keyword: '',
  categoryId: '',
  page: 1,
  sortBy: 'name',
  sortOrder: 'asc',
}

export function MenuPage({ catalogOnly = false }: { catalogOnly?: boolean }) {
  const { t: translate } = useTranslation()
  const navigate = useNavigate()
  const [copyrightYear] = useState(() => new Date().getFullYear())
  const [draft, setDraft] = useState('')
  const [filters, setFilters] = useState<MenuFilters>(initialFilters)
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [unstoredOrder, setUnstoredOrder] = useState<OrderAccess | null>(null)

  const { items: cartItems, addItem, updateQuantity, removeItem, clearCart } = useCart()

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
  const CatalogHeading = catalogOnly ? 'h1' : 'h2'
  useEffect(() => {
    if (catalogOnly) window.scrollTo(0, 0)
  }, [catalogOnly])

  function resetFilters() {
    setDraft('')
    setFilters((current) => ({ ...current, keyword: '', categoryId: '', page: 1 }))
  }

  function selectCategory(categoryId: string) {
    setDraft('')
    setFilters((current) => ({ ...current, categoryId, keyword: '', page: 1 }))
  }

  function handleSelectItem(item: MenuItem) {
    setSelectedProduct(item)
  }

  function handleConfirmProduct(item: CartItem) {
    addItem(item)
    setSelectedProduct(null)
    setIsCartOpen(true)
  }

  function handleOrderCreated(order: OrderAccess) {
    setIsCartOpen(false)
    clearCart()
    if (order.customerId) {
      navigate(`/account/orders/${order.requestId}`)
      return
    }
    try {
      rememberOrder(order)
      navigate('/order')
    } catch {
      setUnstoredOrder(order)
    }
  }

  function handleSelectFeaturedCategory(categoryId: string) {
    selectCategory(categoryId)
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })
  }

  const featuredBestsellers = menu.data?.list.slice(0, 5) ?? []

  if (unstoredOrder)
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
          <p role="alert">{translate('takeaway.storageWarning')}</p>
          <OrderTrackingView orderAuth={unstoredOrder} onNewOrder={() => setUnstoredOrder(null)} />
        </main>
      </div>
    )

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* 1. Header */}
      <SiteHeader onOpenCart={() => setIsCartOpen(true)} />

      {/* 2. Hero Section */}
      {!catalogOnly && <MenuHero />}

      {/* 3. Benefit / Trust Strip */}
      {!catalogOnly && <TrustBadgesStrip />}

      {/* 4. Danh mục nổi bật */}
      {!catalogOnly && <FeaturedCategories
        categories={categories.data}
        onSelectCategory={handleSelectFeaturedCategory}
      />}

      {/* 5. Kệ món bán chạy nhất */}
      {!catalogOnly && !filtered && filters.page === 1 && (menu.data?.totalItems ?? 0) > 5 && (
        <BestsellersShelf items={featuredBestsellers} onSelect={handleSelectItem} />
      )}

      {/* 6. Menu Catalog Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 flex-1 w-full" id="menu">
        {/* Banner Khám phá thực đơn with Search inside */}
        <div className="relative rounded-[16px] overflow-hidden bg-primary text-white p-6 sm:p-10 mb-8 shadow-md">
          <img
            src="/hero-coffee.webp"
            width={1376}
            height={768}
            loading="lazy"
            decoding="async"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/60" />

          <div className="relative z-10 max-w-xl">
            <CatalogHeading className="text-2xl sm:text-3xl font-extrabold">
              {translate('menu.heading')}
            </CatalogHeading>
            <p className="mt-1 text-xs sm:text-sm text-emerald-100/90 font-medium">
              {translate('menu.description')}
            </p>

            <form
              className="mt-5 flex items-center gap-2 max-w-md"
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
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label={translate('menu.searchLabel')}
                  placeholder={translate('menu.searchPlaceholder')}
                  maxLength={120}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="pl-9 bg-card text-card-foreground rounded-lg h-10 border-0 shadow-xs"
                />
              </div>
              <Button
                type="submit"
                className="bg-accent text-white hover:bg-accent/90 h-10 px-5 rounded-[10px] font-bold shadow-xs cursor-pointer"
              >
                {translate('common.search')}
              </Button>
            </form>
          </div>
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

        {/* Horizontal Category Filter Pills */}
        <div
          role="tablist"
          aria-label={translate('storefront.categoryFilter')}
          className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!filters.categoryId && !filters.keyword}
            onClick={resetFilters}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
              !filters.categoryId && !filters.keyword
                ? 'bg-primary text-white shadow-xs'
                : 'bg-card border border-border/80 text-foreground hover:bg-muted/70',
            )}
          >
            {translate('common.all')}
          </button>
          {categories.data?.map((cat) => {
            const isSelected = filters.categoryId === cat.id

            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => selectCategory(cat.id)}
                className={cn(
                  'rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
                  isSelected
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-card border border-border/80 text-foreground hover:bg-muted/70',
                )}
              >
                {cat.name}
              </button>
            )
          })}
        </div>

        {/* 2-Column Catalog Layout: Left Sidebar + Right Product Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Sidebar Category Navigation */}
          <MenuCatalogSidebar
            categories={categories.data}
            activeCategoryId={filters.categoryId}
            totalItems={menu.data?.totalItems}
            onSelectCategory={selectCategory}
          />

          {/* Right Product Grid Area */}
          <div className="lg:col-span-9 xl:col-span-9">
            {/* Toolbar: Result count & Sort dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-border/80">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-foreground">
                  {filters.categoryId
                    ? (categories.data?.find((c) => c.id === filters.categoryId)?.name ??
                      translate('storefront.category'))
                    : filters.keyword
                      ? translate('storefront.searchResults', { keyword: filters.keyword })
                      : translate('menu.allItems')}
                </span>
                <span className="text-xs font-semibold text-muted-foreground" role="status">
                  (
                  {menu.data
                    ? translate('menu.count', { count: menu.data.totalItems })
                    : translate('common.loading')}
                  )
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!selectedProduct && !isCartOpen && menu.isSuccess && !menu.isError && <StorefrontPromotion />}
                {filtered && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground h-8 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    {translate('common.clearFilters')}
                  </Button>
                )}

                <div className="flex items-center gap-1.5 text-xs">
                  <label htmlFor="menu-sort" className="text-muted-foreground">
                    {translate('menu.sortLabel')}
                  </label>
                  <select
                    id="menu-sort"
                    value={`${filters.sortBy}-${filters.sortOrder}`}
                    onChange={(event) => {
                      const value = event.target.value
                      setFilters((current) => ({
                        ...current,
                        sortBy: value === 'name-asc' ? 'name' : 'price',
                        sortOrder: value === 'price-desc' ? 'desc' : 'asc',
                        page: 1,
                      }))
                    }}
                    className="min-h-10 min-w-0 rounded-[8px] border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-primary cursor-pointer"
                  >
                    <option value="name-asc">{translate('menu.sortName')}</option>
                    <option value="price-asc">{translate('menu.sortPriceAsc')}</option>
                    <option value="price-desc">{translate('menu.sortPriceDesc')}</option>
                  </select>
                </div>
              </div>
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
                    className="mt-3 gap-1.5 cursor-pointer"
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
                      className="aspect-square rounded-[14px] border border-border bg-muted/40 animate-pulse"
                    />
                  ))}
                </div>
              ) : menu.data.list.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-border bg-card p-12 text-center">
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
                      className="mt-4 cursor-pointer"
                    >
                      {translate('common.firstPage')}
                    </Button>
                  ) : filtered ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="mt-4 cursor-pointer"
                    >
                      {translate('common.clearFilters')}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {menu.data.list.map((item) => (
                    <MenuCard key={item.id} item={item} onSelect={handleSelectItem} />
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
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: current.page - 1,
                    }))
                  }
                  className="h-8 gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {translate('common.previousPage')}
                </Button>
                <span className="text-xs font-semibold text-muted-foreground">
                  {translate('storefront.page', { current: menu.data.currentPage, total: menu.data.totalPages })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={filters.page >= menu.data.totalPages || menu.isFetching}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: current.page + 1,
                    }))
                  }
                  className="h-8 gap-1.5 cursor-pointer"
                >
                  {translate('common.nextPage')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 7. Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          item={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onConfirm={handleConfirmProduct}
        />
      )}

      {/* 8. Slide-over Cart Checkout Drawer */}
      {isCartOpen && (
        <CartCheckoutDrawer
          cart={cartItems}
          onClose={() => setIsCartOpen(false)}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onAppendItems={(appended) => appended.forEach((it) => addItem(it))}
          onOrderCreated={handleOrderCreated}
        />
      )}

      {/* 9. Site Footer */}
      <StoreFooter storeData={store.data ?? undefined} copyrightYear={copyrightYear} />
    </div>
  )
}
