import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Translation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/shared/ui/button'

export class AppErrorBoundary extends Component<
  { children: ReactNode; scope?: 'app' | 'page' },
  { failed: boolean; reload: boolean }
> {
  state = { failed: false, reload: false }

  static getDerivedStateFromError(error: unknown) {
    return {
      failed: true,
      reload: error instanceof Error && (
        error.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .+ failed/i.test(error.message)
      ),
    }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    // Never report component props, credentials, URLs or provider response bodies.
    console.error('ui.render.failed', { name: error instanceof Error ? error.name : 'UnknownError' })
  }

  render() {
    if (!this.state.failed) return this.props.children
    const local = this.props.scope === 'page'
    const retryLocally = local && !this.state.reload
    const Container = local ? 'section' : 'main'
    return (
      <Translation>
        {(t) => (
          <Container className="mx-auto max-w-lg space-y-4 p-6" role="alert">
            <h1 className="text-xl font-semibold">{t('app.screenFailed')}</h1>
            <p>{t('app.screenFailedInfo')}</p>
            <Button onClick={() => {
              if (retryLocally) this.setState({ failed: false, reload: false })
              else window.location.reload()
            }}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t(retryLocally ? 'common.retry' : 'common.reload')}
            </Button>
          </Container>
        )}
      </Translation>
    )
  }
}
