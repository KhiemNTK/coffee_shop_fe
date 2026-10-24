import type { ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { PermissionGate } from '../../src/features/auth/staff-layout'
import { createPermissionAccess } from '../../src/shared/auth/permissions'

let root: Root | undefined
let container: HTMLDivElement | undefined

// Exercise malformed runtime props without adding a test route to the application.
export function renderGate(policy: unknown) {
  root?.unmount()
  container?.remove()
  container = document.createElement('div')
  container.id = 'permission-gate-probe'
  document.body.append(container)
  root = createRoot(container)
  root.render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={{ access: createPermissionAccess(['/menu_read']) }} />}>
          <Route element={<PermissionGate {...(policy as ComponentProps<typeof PermissionGate>)} />}>
            <Route path="/" element={<p data-testid="allowed">Allowed</p>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}
