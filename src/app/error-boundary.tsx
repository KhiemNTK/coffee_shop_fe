import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Translation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Button } from '../shared/ui/button'

export class AppErrorBoundary extends Component<
  { children: ReactNode; scope?: 'app' | 'page' },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    // Never report component props, credentials, URLs or provider response bodies.
    console.error('ui.render.failed', { name: error.name })
  }

  render() {
    if (!this.state.failed) return this.props.children
    const local = this.props.scope === 'page'
    const Container = local ? 'section' : 'main'
    return (
      <Translation>
        {(t) => (
          <Container className="mx-auto max-w-lg space-y-4 p-6" role="alert">
            <h1 className="text-xl font-semibold">{t('app.screenFailed')}</h1>
            <p>{t('app.screenFailedInfo')}</p>
            <Button onClick={() => {
              if (local) this.setState({ failed: false })
              else window.location.reload()
            }}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t(local ? 'common.retry' : 'common.reload')}
            </Button>
          </Container>
        )}
      </Translation>
    )
  }
}
