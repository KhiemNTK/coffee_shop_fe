import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import vi from './locales/vi.js'

export type Language = 'vi' | 'en'
export type TranslationKey = keyof typeof vi
const storageKey = 'coffee_shop_language'
export const i18n = createInstance()
void i18n.use(initReactI18next).init({
  lng: 'vi',
  fallbackLng: 'vi',
  supportedLngs: ['vi', 'en'],
  resources: { vi: { translation: vi } },
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
})

export const currentLanguage = (): Language => (i18n.resolvedLanguage === 'en' ? 'en' : 'vi')
export const displayLocale = () => (currentLanguage() === 'en' ? 'en-GB' : 'vi-VN')

export async function changeLanguage(language: Language) {
  if (language !== 'vi' && language !== 'en') throw new Error('Unsupported language')
  if (language === 'en' && !i18n.hasResourceBundle('en', 'translation')) {
    const { default: en } = await import('./locales/en.js')
    i18n.addResourceBundle('en', 'translation', en)
  }
  await i18n.changeLanguage(language)
  document.documentElement.lang = language
  try {
    localStorage.setItem(storageKey, language)
  } catch {
    /* The current tab still works without storage. */
  }
}

export async function initializeI18n() {
  let language: Language = 'vi'
  try {
    if (localStorage.getItem(storageKey) === 'en') language = 'en'
  } catch {
    /* Storage may be disabled. */
  }
  try {
    await changeLanguage(language)
  } catch {
    document.documentElement.lang = 'vi'
  }
}
