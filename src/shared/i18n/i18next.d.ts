import type vi from './locales/vi.js'
import 'i18next'
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    keySeparator: false
    nsSeparator: false
    returnNull: false
    resources: { translation: typeof vi }
  }
}
