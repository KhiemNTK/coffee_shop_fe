import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './app/query-client'
import { AppRouter } from './app/router'
import { AppErrorBoundary } from './app/error-boundary'
import { ConnectionStatus } from './app/connection-status'
import { initializeI18n } from './shared/i18n'
import { LanguageSelector } from './shared/i18n/language-selector'
import { ThemeProvider } from './shared/theme'

void initializeI18n().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppErrorBoundary>
          <ThemeProvider>
            <LanguageSelector />
            <ConnectionStatus />
            <AppRouter />
          </ThemeProvider>
        </AppErrorBoundary>
      </QueryClientProvider>
    </StrictMode>,
  ),
)
