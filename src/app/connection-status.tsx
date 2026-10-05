import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

function subscribe(notify: () => void) {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}

export function ConnectionStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  if (online) return null
  return <div role="status" className="flex items-center gap-2 border-b border-amber-600 bg-amber-50 p-3 text-sm text-amber-950">
    <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
    Thiết bị đang ngoại tuyến. Dữ liệu có thể chưa được cập nhật; chưa gửi lại giao dịch chưa rõ kết quả.
  </div>
}
