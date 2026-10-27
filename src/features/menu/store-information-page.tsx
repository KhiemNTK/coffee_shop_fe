import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ExternalLink, MapPin, Phone, RefreshCw } from 'lucide-react'
import { getPublicStore } from './menu.api'
import { StoreFooter } from './components/store-footer'
import { SiteHeader } from '@/shared/components/site-header'
import { ApiErrorAlert } from '@/shared/ui/api-error-alert'
import { Button } from '@/shared/ui/button'
import { buttonVariants } from '@/shared/ui/button-variants'

export default function StoreInformationPage({ section }: { section: 'about' | 'contact' }) {
  const { t } = useTranslation()
  const heading = useRef<HTMLHeadingElement>(null)
  const [year] = useState(() => new Date().getFullYear())
  const store = useQuery({
    queryKey: ['public-store'],
    queryFn: ({ signal }) => getPublicStore(signal),
  })
  const about = section === 'about'
  const name = store.data?.name || 'Coffee Homes'
  const title = `${t(about ? 'storefront.about' : 'storefront.contact')} | ${name}`
  const phone = store.data?.phone?.replace(/[\s().-]/g, '')
  const callUrl = phone && /^\+?\d{7,15}$/.test(phone) ? `tel:${phone}` : undefined

  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }, [section])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative isolate overflow-hidden bg-primary text-white">
          <img
            src="/hero-coffee-640.webp"
            srcSet="/hero-coffee-640.webp 640w, /hero-coffee.webp 1376w"
            sizes="100vw"
            width={1376}
            height={768}
            fetchPriority="high"
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-black/55" />
          <div className="mx-auto flex min-h-72 max-w-7xl flex-col justify-center px-4 py-12 sm:min-h-80 sm:px-6">
            <p className="mb-3 text-sm font-semibold text-white/85">
              {t(about ? 'storefront.about' : 'storefront.contact')}
            </p>
            <h1
              ref={heading}
              tabIndex={-1}
              className="max-w-3xl break-words text-3xl font-bold leading-tight outline-none sm:text-5xl"
            >
              {about ? name : t('store.contactTitle', { name })}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/90">
              {t(about ? 'store.aboutIntro' : 'store.contactIntro')}
            </p>
          </div>
        </section>

        {about && (
          <section className="mx-auto grid max-w-7xl gap-6 border-b border-border px-4 py-10 sm:px-6 sm:py-12 md:grid-cols-2 md:gap-12">
            <h2 className="max-w-md text-2xl font-semibold">{t('store.everydayHeading')}</h2>
            <div className="space-y-5">
              <p className="max-w-xl leading-relaxed text-muted-foreground">
                {t('store.everydayBody')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/menu" className={buttonVariants({ className: 'min-h-11 rounded-md' })}>
                  {t('storefront.menu')}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  to="/reservations"
                  className={buttonVariants({
                    variant: 'outline',
                    className: 'min-h-11 rounded-md',
                  })}
                >
                  <CalendarDays size={16} aria-hidden="true" />
                  {t('storefront.reserve')}
                </Link>
              </div>
            </div>
          </section>
        )}

        <section
          aria-label={t('storefront.contactHeading')}
          className="mx-auto min-h-64 max-w-7xl px-4 py-10 sm:px-6 sm:py-12"
        >
          <h2 className="mb-6 text-2xl font-semibold">
            {t(about ? 'store.visitHeading' : 'storefront.contactHeading')}
          </h2>
          {store.isPending ? (
            <p role="status">{t('common.loading')}</p>
          ) : store.isError ? (
            <div className="max-w-xl space-y-3">
              <ApiErrorAlert error={store.error} />
              <Button
                variant="outline"
                onClick={() => void store.refetch()}
                disabled={store.isFetching}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <dl className="grid gap-8 md:grid-cols-2 md:gap-12">
              <div className="space-y-3">
                <dt className="flex items-center gap-2 font-semibold">
                  <MapPin
                    size={20}
                    className="text-primary dark:text-emerald-300"
                    aria-hidden="true"
                  />
                  {t('store.address')}
                </dt>
                <dd className="space-y-4">
                  <p className="max-w-xl break-words leading-relaxed text-muted-foreground">
                    {store.data.address || t('store.addressMissing')}
                  </p>
                  {store.data.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.data.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({
                        variant: 'outline',
                        className: 'min-h-11 rounded-md',
                      })}
                    >
                      {t('store.directions')}
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                  )}
                </dd>
              </div>
              <div className="space-y-3">
                <dt className="flex items-center gap-2 font-semibold">
                  <Phone
                    size={20}
                    className="text-primary dark:text-emerald-300"
                    aria-hidden="true"
                  />
                  {t('store.phone')}
                </dt>
                <dd className="space-y-4">
                  <p className="break-words text-lg font-semibold tabular-nums">
                    {store.data.phone || t('store.phoneMissing')}
                  </p>
                  {callUrl && (
                    <a
                      href={callUrl}
                      className={buttonVariants({
                        variant: 'outline',
                        className: 'min-h-11 rounded-md',
                      })}
                    >
                      <Phone size={16} aria-hidden="true" />
                      {t('store.call')}
                    </a>
                  )}
                </dd>
              </div>
            </dl>
          )}
          {!about && (
            <div className="mt-9 flex flex-wrap gap-5 border-t border-border pt-6 text-sm font-semibold">
              <Link
                to="/menu"
                className="inline-flex min-h-11 items-center gap-2 text-primary dark:text-emerald-300 underline-offset-4 hover:underline"
              >
                {t('storefront.menu')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                to="/reservations"
                className="inline-flex min-h-11 items-center gap-2 text-primary dark:text-emerald-300 underline-offset-4 hover:underline"
              >
                <CalendarDays size={16} aria-hidden="true" />
                {t('storefront.reserve')}
              </Link>
            </div>
          )}
        </section>
      </main>
      <StoreFooter storeData={store.data ?? undefined} copyrightYear={year} />
    </div>
  )
}
