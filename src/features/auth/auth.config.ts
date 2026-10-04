export const authConfig = {
  signupEnabled: import.meta.env.DEV && import.meta.env.VITE_AUTH_SIGNUP_ENABLED === 'true',
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '',
  turnstileSiteKey: (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? '',
}
