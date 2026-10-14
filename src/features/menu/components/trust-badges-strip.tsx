import { Clock, HeartHandshake, Leaf, Zap } from 'lucide-react'

export function TrustBadgesStrip() {
  return (
    <section className="border-b border-border/80 bg-card py-6 sm:py-7 shadow-2xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="flex items-center gap-3.5 rounded-[12px] p-2.5 sm:p-3 transition-colors hover:bg-muted/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                Cà phê nguyên chất
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                100% Arabica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-[12px] p-2.5 sm:p-3 transition-colors hover:bg-muted/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                Không gian ấm cúng
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Phù hợp làm việc &amp; gặp gỡ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-[12px] p-2.5 sm:p-3 transition-colors hover:bg-muted/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                Đặt hàng nhanh
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Nhận món trong 5-10 phút
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-[12px] p-2.5 sm:p-3 transition-colors hover:bg-muted/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
              <Zap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                Thanh toán tiện lợi
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Nhiều hình thức thanh toán
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
