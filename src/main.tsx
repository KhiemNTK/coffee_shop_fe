import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './app/query-client'
import { AppRouter } from './app/router'
import { AppErrorBoundary } from './app/error-boundary'
import { ConnectionStatus } from './app/connection-status'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <ConnectionStatus />
        <AppRouter />
      </AppErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
