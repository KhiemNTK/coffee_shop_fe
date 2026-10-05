import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '../shared/ui/button'

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    // Never report component props, credentials, URLs or provider response bodies.
    console.error('ui.render.failed', { name: error.name })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <main className="mx-auto max-w-lg space-y-4 p-6" role="alert">
      <h1 className="text-xl font-semibold">Chưa mở được màn hình</h1>
      <p>Thao tác vừa gửi có thể đã được xử lý. Kiểm tra trạng thái giao dịch sau khi tải lại.</p>
      <Button onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Tải lại</Button>
    </main>
  }
}
