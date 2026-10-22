import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Coffee, Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { getPublicStore } from '@/features/menu/menu.api'
import { useCustomer } from '@/features/customers/customers.api'
import { buttonVariants } from '@/shared/ui/button-variants'
import { useCart } from '@/features/online-orders/cart'
import { ThemeToggle } from '@/shared/theme'
import { cn } from '@/shared/ui/utils'

export function SiteHeader({
  onOpenCart,
  onSearchClick,
}: {
  onOpenCart?: () => void
  onSearchClick?: () => void
}) {
  const { t: translate } = useTranslation()
  const location = useLocation()
  const { totalCount } = useCart()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const customer = useCustomer()
  const signInState = customer.data
    ? undefined
    : { returnTo: location.pathname + location.search + location.hash }

  const store = useQuery({
    queryKey: ['public-store'],
    queryFn: ({ signal }) => getPublicStore(signal),
  })

  const navLinks = [
    { href: '/', label: 'Trang chủ', isRoute: true },
    { href: '/menu', label: 'Menu', isRoute: true },
    { href: '/#bestsellers', label: 'Ưu đãi', isRoute: false },
    { href: '/#about', label: 'Câu chuyện', isRoute: false },
    { href: '/#contact', label: 'Liên hệ', isRoute: false },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Left: Mobile Hamburger & Brand Logo */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
            aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            className="lg:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <Link
            to="/"
            className="min-w-0 flex items-center gap-2 text-sm sm:text-lg font-bold text-primary group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs group-hover:scale-105 transition-transform">
              <Coffee className="h-5 w-5" />
            </div>
            <span className="min-w-0 break-words font-extrabold tracking-tight text-foreground">
              {store.data?.name ?? 'Coffee Homes'}
            </span>
          </Link>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-6" aria-label={translate('menu.mainNav')}>
          {navLinks.map((link) =>
            link.isRoute ? (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'text-sm font-semibold transition-colors',
                  location.pathname === link.href
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ),
          )}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <ThemeToggle />

          <Link
            to="/wishlist"
            aria-label={translate('wishlist.title')}
            title={translate('wishlist.title')}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors"
          >
            <Heart className="h-4.5 w-4.5" aria-hidden="true" />
          </Link>

          {/* Quick Search Button */}
          {onSearchClick ? (
            <button
              type="button"
              onClick={onSearchClick}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors hidden sm:flex cursor-pointer"
              title="Tìm kiếm món"
              aria-label="Tìm kiếm món"
            >
              <Search className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/menu"
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors hidden sm:flex"
              title="Tìm kiếm món"
              aria-label="Tìm kiếm món"
            >
              <Search className="h-4 w-4" />
            </Link>
          )}

          {/* Book Table Button (Desktop) */}
          <Link
            to="/reservations"
            className={cn(
              buttonVariants({ size: 'sm' }),
              'hidden sm:inline-flex gap-1.5 font-bold rounded-full bg-primary text-white hover:bg-primary-hover shadow-xs text-xs px-4 h-8 sm:h-9',
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Đặt bàn</span>
          </Link>

          {/* Cart Icon with Accessible Badge */}
          <Link
            to="/cart"
            onClick={(e) => {
              if (onOpenCart) {
                e.preventDefault()
                onOpenCart()
              }
            }}
            className="relative p-2 rounded-lg text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            title="Giỏ hàng của bạn"
            aria-label={`Giỏ hàng của bạn, ${totalCount} món`}
          >
            <ShoppingBag className="h-5 w-5 text-primary" />
            <span
              className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-promo px-1 text-[10px] font-bold text-white shadow-xs"
              aria-hidden="true"
            >
              {totalCount}
            </span>
          </Link>

          <Link
            to={customer.data ? '/account' : '/customer/sign-in'}
            state={signInState}
            aria-label={translate(customer.data ? 'customer.account' : 'wishlist.customerSignIn')}
            title={translate(customer.data ? 'customer.account' : 'wishlist.customerSignIn')}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md px-2 text-primary hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <UserRound className="h-5 w-5" aria-hidden="true" />
            <span className="hidden xl:inline text-sm font-semibold">
              {translate(customer.data ? 'customer.account' : 'auth.signIn')}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Panel */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="lg:hidden border-t border-border bg-card/98 px-4 py-4 backdrop-blur-lg shadow-lg animate-in slide-in-from-top-2 duration-200"
        >
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) =>
              link.isRoute ? (
                <Link
                  key={`mobile-${link.href}`}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                    location.pathname === link.href
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={`mobile-${link.href}`}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3 py-2.5 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ),
            )}

            <div className="pt-3 border-t border-border/80 mt-2 flex flex-col gap-2">
              <Link
                to={customer.data ? '/account' : '/customer/sign-in'}
                state={signInState}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-3 text-sm font-semibold text-primary"
              >
                {translate(customer.data ? 'customer.account' : 'wishlist.customerSignIn')}
              </Link>
              <Link
                to="/staff"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-3 text-sm text-muted-foreground"
              >
                {translate('customer.staffPortal')}
              </Link>
              <Link
                to="/reservations"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  buttonVariants({ size: 'default' }),
                  'w-full justify-center gap-2 font-bold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-xs',
                )}
              >
                <CalendarDays className="h-4 w-4" />
                <span>Đặt bàn trực tuyến</span>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
