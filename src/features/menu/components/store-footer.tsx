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
            <div className="flex items-center gap-2 text-primary dark:text-emerald-300 font-bold text-base">
              <Coffee className="h-5 w-5" />
              <span>{storeData?.name ?? 'Coffee Homes'}</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {translate('storefront.footerDescription')}
            </p>
          </div>

          <div id="contact" className="space-y-2.5">
            <h4 className="font-bold text-foreground text-sm">{translate('storefront.contactHeading')}</h4>
            {storeData?.address && (
              <p className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary dark:text-emerald-300 mt-0.5" />
                <span>{storeData.address}</span>
              </p>
            )}
            {storeData?.phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary dark:text-emerald-300" />
                <span>Hotline: {storeData.phone}</span>
              </p>
            )}
            {!storeData?.address && !storeData?.phone && (
              <p className="text-muted-foreground">{translate('storefront.contactPending')}</p>
            )}
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-foreground text-sm">{translate('storefront.serviceHours')}</h4>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary dark:text-emerald-300" />
              <span>{translate('storefront.dailyHours')}</span>
            </p>
            <p className="text-muted-foreground">
              {translate('storefront.footerService')}
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-foreground text-sm">{translate('storefront.quickLinks')}</h4>
            <ul className="space-y-1.5 font-medium">
              <li>
                <Link to="/menu" className="hover:text-primary transition-colors">
                  {translate('storefront.drinksMenu')}
                </Link>
              </li>
              <li><Link to="/about" className="hover:text-primary transition-colors">{translate('storefront.about')}</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">{translate('storefront.contact')}</Link></li>
              <li>
                <Link to="/reservations" className="hover:text-primary transition-colors">
                  {translate('storefront.reserveAtStore')}
                </Link>
              </li>
              <li>
                <Link to="/order" className="hover:text-primary transition-colors">
                  {translate('storefront.trackTakeaway')}
                </Link>
              </li>
              <li>
                <Link to="/sign-in" className="hover:text-primary transition-colors">
                  {translate('storefront.staff')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>{translate('menu.footer', { year: copyrightYear })}</span>
          <span className="text-[11px] text-muted-foreground/80">
            {translate('storefront.footerTagline')}
          </span>
        </div>
      </div>
    </footer>
  )
}
