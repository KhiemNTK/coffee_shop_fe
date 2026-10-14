import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Clock, Coffee, MapPin, Phone } from 'lucide-react'

export function StoreFooter({
  storeData,
  copyrightYear,
}: {
  storeData?: {
    name: string | null
    address: string | null
    phone: string | null
  }
  copyrightYear: number
}) {
  const { t: translate } = useTranslation()

  return (
    <footer id="about" className="border-t border-border/80 bg-card py-10 text-xs text-muted-foreground mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-base">
              <Coffee className="h-5 w-5" />
              <span>{storeData?.name ?? 'Coffee Shop'}</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Thương hiệu cà phê mộc đậm đà nguyên bản và thức uống tươi ngon mỗi
              ngày cho người sành thưởng thức.
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-foreground text-sm">Địa chỉ &amp; Liên hệ</h4>
            {storeData?.address && (
              <p className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>{storeData.address}</span>
              </p>
            )}
            {storeData?.phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span>Hotline: {storeData.phone}</span>
              </p>
            )}
            {!storeData?.address && !storeData?.phone && (
              <p className="text-muted-foreground">Thông tin liên hệ đang cập nhật</p>
            )}
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-foreground text-sm">Giờ phục vụ</h4>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              <span>Mở cửa hàng ngày: 07:00 – 22:00</span>
            </p>
            <p className="text-muted-foreground">
              Phục vụ tại quán và đặt mang đi giao nhận nhanh chóng.
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-foreground text-sm">Liên kết nhanh</h4>
            <ul className="space-y-1.5 font-medium">
              <li>
                <a href="#menu" className="hover:text-primary transition-colors">
                  Thực đơn món uống
                </a>
              </li>
              <li>
                <Link to="/reservations" className="hover:text-primary transition-colors">
                  Đặt bàn tại quán
                </Link>
              </li>
              <li>
                <Link to="/order" className="hover:text-primary transition-colors">
                  Theo dõi đơn mang đi
                </Link>
              </li>
              <li>
                <Link to="/sign-in" className="hover:text-primary transition-colors">
                  Dành cho nhân viên
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>{translate('menu.footer', { year: copyrightYear })}</span>
          <span className="text-[11px] text-muted-foreground/80">
            Chất lượng đỉnh cao · Phục vụ tận tâm
          </span>
        </div>
      </div>
    </footer>
  )
}
