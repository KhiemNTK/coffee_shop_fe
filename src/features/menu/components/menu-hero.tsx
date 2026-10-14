import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CalendarDays, ShoppingBag, Sparkles } from 'lucide-react'

export function MenuHero() {
  const { t: translate } = useTranslation()

  return (
    <section
      className="relative overflow-hidden bg-[#0a1f16] text-white py-12 sm:py-16 lg:py-20"
      aria-labelledby="page-title"
    >
      <div className="menu-cover absolute inset-0 z-0">
        <img
          src="/hero-coffee.jpg"
          alt={translate('menu.shopImage')}
          className="w-full h-full object-cover object-center opacity-30 mix-blend-luminosity"
          onError={(e) => {
            e.currentTarget.src = '/menu-cover.jpg'
          }}
        />
      </div>

      {/* Emerald gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a1f16] via-[#0a1f16]/95 sm:via-[#0a1f16]/85 to-transparent z-10" />

      <div className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Content Column */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-amber-300 border border-amber-400/30 backdrop-blur-xs mb-4">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>GOOD COFFEE · BETTER DAYS</span>
            </div>

            <h1
              id="page-title"
              className="text-3xl font-extrabold sm:text-5xl lg:text-6xl tracking-tight leading-tight text-white"
            >
              Một ly cà phê, <br className="hidden sm:inline" />
              một ngày{' '}
              <span className="text-amber-400 font-extrabold">
                tuyệt vời
              </span>
              .
            </h1>

            <p className="mt-4 max-w-xl text-sm sm:text-base text-emerald-100/90 leading-relaxed font-normal">
              Trải nghiệm hương vị cà phê nguyên bản trong không gian ấm cúng và hiện đại.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/reservations"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 text-sm font-bold shadow-lg transition-all active:scale-95"
              >
                <CalendarDays className="h-4 w-4" />
                <span>Đặt bàn ngay</span>
              </Link>

              <a
                href="#menu"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 hover:bg-white/20 text-white px-6 py-3 text-sm font-semibold transition-all active:scale-95 backdrop-blur-xs"
              >
                <span>Xem menu</span>
              </a>

              <Link
                to="/order"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 hover:bg-white/10 text-emerald-100 px-5 py-3 text-sm font-semibold transition-colors"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Đặt mang đi</span>
              </Link>
            </div>
          </div>

          {/* Right Showcase Card */}
          <div className="hidden lg:block lg:col-span-5">
            <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-card/20 backdrop-blur-sm group">
              <img
                src="/cappuccino.jpg"
                alt="Cà phê Coffee Homes nghệ thuật"
                className="w-full aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              <div className="absolute top-4 right-4 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Hương vị tuyển chọn</span>
              </div>


              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Hương vị Signature</p>
                <p className="text-lg font-bold">100% Cà phê Arabica Cầu Đất nguyên chất</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
