import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import type { Session } from './session'
import { GoogleAccount } from './google-account'
import { Badge } from '@/shared/ui'

export default function StaffAccount() {
  const { t: translate } = useTranslation()
  const { employee, authorization } = useOutletContext<Session>()
  return (
    <div className="space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold break-words">{employee.fullName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{translate('auth.staffAccount')}</p>
      </header>
      <section aria-labelledby="employee-information" className="space-y-3">
        <h2 id="employee-information" className="text-base font-semibold">
          {translate('auth.employeeDetails')}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd className="break-all">{employee.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{translate('auth.position')}</dt>
            <dd>{employee.position?.name ?? translate('common.unavailable')}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{translate('auth.roles')}</dt>
            <dd className="break-words">
              {authorization.roleNames.join(', ') || translate('common.unassigned')}
            </dd>
          </div>
        </dl>
      </section>
      <GoogleAccount linked={employee.googleLinked} />
      <section aria-labelledby="employee-permissions" className="space-y-3 border-t pt-4">
        <h2 id="employee-permissions" className="text-base font-semibold">
          Quyền hạn được cấp ({authorization.permissionKeys.length})
        </h2>
        {authorization.permissionKeys.length ? (
          <div className="flex flex-wrap gap-2">
            {authorization.permissionKeys.map((key) => (
              <Badge
                key={key}
                variant="secondary"
                className="max-w-full whitespace-normal break-all font-mono text-xs"
              >
                {key}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{translate('auth.noPermissions')}</p>
        )}
      </section>
    </div>
  )
}
