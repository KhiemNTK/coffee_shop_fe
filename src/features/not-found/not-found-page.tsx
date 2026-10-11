import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Coffee, Home, ShoppingBag } from 'lucide-react'
import { Button } from '../../shared/ui/button'
import { buttonVariants } from '../../shared/ui/button-variants'
import { Badge } from '../../shared/ui/badge'
import { cn } from '../../shared/ui/utils'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/20">
      {/* Header */}
      <header className="border-b border-border/80 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-base font-bold text-primary">
            <Coffee className="h-5 w-5" />
            <span>Coffee Shop</span>
          </Link>
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground',
            )}
          >
            <Home className="h-3.5 w-3.5" />
            Trang chủ
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
        {/* Soft Ambient Background Glow */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
          <div className="w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-2xl translate-y-12" />
        </div>

        <div className="relative z-10 max-w-lg w-full text-center space-y-6">
          {/* Coffee Cup Icon with Notification Beacon */}
          <div className="mx-auto flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 text-primary shadow-sm">
              <Coffee className="h-12 w-12" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
              </span>
            </div>

            <Badge variant="warning" className="mt-4 font-bold text-[11px] uppercase tracking-wider">
              Lỗi 404 • Trang không tồn tại
            </Badge>
          </div>

          {/* Typography */}
          <div className="space-y-2">
            <div className="text-6xl sm:text-8xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-emerald-800 to-amber-600 bg-clip-text text-transparent select-none tabular-nums">
              404
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Không tìm thấy trang
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
              Tách cà phê bạn tìm kiếm dường như đã cạn hoặc đường dẫn này không còn tồn tại trên hệ thống. Hãy quay lại trang chính nhé!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className={cn(
                buttonVariants({ variant: 'default', size: 'default' }),
                'w-full sm:w-auto gap-2 font-bold shadow-md shadow-primary/15 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer',
              )}
            >
              <Coffee className="h-4 w-4" />
              Về thực đơn
            </Link>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto gap-1.5 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại trang trước
            </Button>
          </div>

          {/* Quick Shortcuts */}
          <div className="pt-6 border-t border-border/80">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Gợi ý điểm đến khác:
            </p>
            <div className="grid grid-cols-2 gap-2.5 text-left">
              <Link
                to="/order"
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-primary/40 hover:shadow-xs transition-all group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Đặt mang đi
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    Giao & Lấy tận nơi
                  </span>
                </div>
              </Link>

              <Link
                to="/reservations"
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-primary/40 hover:shadow-xs transition-all group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-foreground group-hover:text-amber-700 transition-colors">
                    Đặt bàn trước
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    Giữ chỗ chu đáo
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        <span>© 2026 Coffee Shop • Hương vị cà phê mộc nguyên bản</span>
      </footer>
    </div>
  )
}
