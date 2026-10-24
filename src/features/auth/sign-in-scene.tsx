import type { ReactNode } from 'react'
import { Coffee } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './sign-in-scene.css'

export function SignInScene({ children, header }: { children: ReactNode; header: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="sign-in-scene">
      <picture className="sign-in-scene__photo" aria-hidden="true">
        <source media="(max-width: 640px)" srcSet="/hero-coffee-640.webp" />
        <img src="/hero-coffee.webp" alt="" width="1376" height="768" fetchPriority="high" />
      </picture>
      <div className="sign-in-scene__shade" aria-hidden="true" />
      <div className="sign-in-scene__header">{header}</div>
      <main className="sign-in-scene__main">
        <div className="sign-in-scene__welcome">
          <div className="sign-in-scene__wordmark">
            <Coffee size={30} strokeWidth={1.5} aria-hidden="true" />
            <span>Coffee Homes</span>
          </div>
          <p>{t('auth.sceneWelcome')}</p>
        </div>
        <div className="sign-in-scene__panel">{children}</div>
      </main>
      <footer className="sign-in-scene__footer">
        <span>Coffee Homes</span>
        <span aria-hidden="true">/</span>
        <span>{t('auth.sceneFooter')}</span>
      </footer>
    </div>
  )
}
