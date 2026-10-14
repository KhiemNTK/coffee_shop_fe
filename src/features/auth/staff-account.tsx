import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import {
  User,
  Shield,
  KeyRound,
  Search,
  Lock,
  UtensilsCrossed,
  ChefHat,
  Banknote,
  Package,
  Users2,
  FileSpreadsheet,
  Settings,
} from 'lucide-react'
import type { Session } from './session'
import { GoogleAccount } from './google-account'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/shared/ui'

// Categorization helper for permission keys
interface PermissionCategory {
  id: string
  name: string
  icon: typeof KeyRound
  color: string
  match: (key: string) => boolean
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'pos',
    name: 'Bán hàng & POS',
    icon: UtensilsCrossed,
    color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
    match: (k) =>
      k.startsWith('/dining-tables') ||
      k.startsWith('/orders_sessions') ||
      k.startsWith('/orders_lines') ||
      k.startsWith('/orders_tables') ||
      k.startsWith('/orders'),
  },
  {
    id: 'kds',
    name: 'Bếp & KDS',
    icon: ChefHat,
    color: 'text-rose-600 bg-rose-500/10 border-rose-500/20',
    match: (k) => k.startsWith('/kitchen') || k.startsWith('/kds'),
  },
  {
    id: 'cashier',
    name: 'Thu ngân & Ca làm việc',
    icon: Banknote,
    color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
    match: (k) =>
      k.startsWith('/cashier') ||
      k.startsWith('/payments') ||
      k.startsWith('/invoices') ||
      k.startsWith('/cash'),
  },
  {
    id: 'inventory',
    name: 'Kho & Nguyên vật liệu',
    icon: Package,
    color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
    match: (k) =>
      k.startsWith('/inventory') ||
      k.startsWith('/ingredients') ||
      k.startsWith('/categories') ||
      k.startsWith('/products') ||
      k.startsWith('/menu'),
  },
  {
    id: 'hr',
    name: 'Nhân sự & Phân quyền',
    icon: Users2,
    color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
    match: (k) =>
      k.startsWith('/employees') ||
      k.startsWith('/roles') ||
      k.startsWith('/permissions') ||
      k.startsWith('/positions'),
  },
  {
    id: 'reports',
    name: 'Báo cáo & Kiểm toán',
    icon: FileSpreadsheet,
    color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
    match: (k) =>
      k.startsWith('/audit') ||
      k.startsWith('/reports') ||
      k.startsWith('/logs') ||
      k.startsWith('/metrics'),
  },
  {
    id: 'system',
    name: 'Hệ thống & Cấu hình',
    icon: Settings,
    color: 'text-slate-600 bg-slate-500/10 border-slate-500/20',
    match: (k) =>
      k.startsWith('/auth') ||
      k.startsWith('/settings') ||
      k.startsWith('/system') ||
      k.startsWith('/stores'),
  },
]

function getInitials(name: string): string {
  if (!name) return 'NV'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  const first = parts[0]![0] ?? ''
  const last = parts[parts.length - 1]![0] ?? ''
  return (first + last).toUpperCase()
}

export default function StaffAccount() {
  const { t: translate } = useTranslation()
  const { employee, authorization } = useOutletContext<Session>()
  const totalPermissions = authorization.permissionKeys.length

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped')

  // Filter permission keys by search query
  const filteredKeys = useMemo(() => {
    const keys = authorization.permissionKeys
    if (!searchQuery.trim()) return keys
    const q = searchQuery.toLowerCase().trim()
    return keys.filter((k) => k.toLowerCase().includes(q))
  }, [authorization.permissionKeys, searchQuery])

  // Group permission keys by category
  const groupedPermissions = useMemo(() => {
    const matchedSet = new Set<string>()
    const groups = PERMISSION_CATEGORIES.map((cat) => {
      const keys = filteredKeys.filter((k) => {
        if (cat.match(k)) {
          matchedSet.add(k)
          return true
        }
        return false
      })
      return { ...cat, keys }
    })

    // Remaining uncategorized keys
    const remainingKeys = filteredKeys.filter((k) => !matchedSet.has(k))
    if (remainingKeys.length > 0) {
      groups.push({
        id: 'other',
        name: 'Quyền hạn khác',
        icon: KeyRound,
        color: 'text-muted-foreground bg-muted border-border',
        match: () => true,
        keys: remainingKeys,
      })
    }

    return groups.filter((g) => g.keys.length > 0)
  }, [filteredKeys])

  // Keys displayed based on category selection
  const displayedCategoryGroups = useMemo(() => {
    if (selectedCategory === 'ALL') return groupedPermissions
    return groupedPermissions.filter((g) => g.id === selectedCategory)
  }, [groupedPermissions, selectedCategory])

  const initials = getInitials(employee.fullName)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header Profile Banner */}
      <header className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-lg sm:text-xl font-bold text-white shadow-xs">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
                  {employee.fullName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Đang hoạt động
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{translate('auth.staffAccount')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {employee.position?.name && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-medium text-xs"
                  >
                    {employee.position.name}
                  </Badge>
                )}
                {authorization.roleNames.map((role) => (
                  <Badge
                    key={role}
                    variant="outline"
                    className="border-primary/20 bg-primary/10 text-primary font-medium text-xs font-mono"
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Account Details & Security (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Employee Details Card */}
          <Card className="border border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <User className="h-4 w-4 text-primary" />
                <h2 id="employee-information">{translate('auth.employeeDetails')}</h2>
              </div>
            </CardHeader>
            <CardContent>
              <section aria-labelledby="employee-information">
                <dl className="space-y-3.5 divide-y divide-border/60">
                  {/* Email */}
                  <div className="min-w-0 pt-2 first:pt-0">
                    <dt className="text-xs font-medium text-muted-foreground">Email</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-foreground break-all">
                      {employee.email}
                    </dd>
                  </div>

                  {/* Position */}
                  <div className="pt-3">
                    <dt className="text-xs font-medium text-muted-foreground">
                      {translate('auth.position')}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">
                      {employee.position?.name ?? translate('common.unavailable')}
                    </dd>
                  </div>

                  {/* Roles */}
                  <div className="pt-3">
                    <dt className="text-xs font-medium text-muted-foreground">
                      {translate('auth.roles')}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground break-words">
                      {authorization.roleNames.join(', ') || translate('common.unassigned')}
                    </dd>
                  </div>

                  {/* Employee ID */}
                  <div className="pt-3">
                    <dt className="text-xs font-medium text-muted-foreground">Mã nhân viên (ID)</dt>
                    <dd className="mt-0.5 font-mono text-xs text-muted-foreground break-all">
                      {employee.id}
                    </dd>
                  </div>
                </dl>
              </section>
            </CardContent>
          </Card>

          {/* Security Card: Google OAuth */}
          <Card className="border border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Lock className="h-4 w-4 text-primary" />
                Bảo mật & Liên kết tài khoản
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GoogleAccount linked={employee.googleLinked} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Permissions Matrix (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <Card className="border border-border/70 shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    <h2 id="employee-permissions">
                      Quyền hạn được cấp ({totalPermissions})
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Danh mục mã phân quyền kỹ thuật đã được phân bổ cho vai trò của bạn
                  </p>
                </div>

                {/* View Mode Switcher */}
                <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('grouped')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      viewMode === 'grouped'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Theo nhóm
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('flat')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      viewMode === 'flat'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tất cả
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              {totalPermissions > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Tìm kiếm mã quyền hạn (vd: kds, order, cashier, table...)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8.5 pl-8 text-xs"
                    />
                  </div>

                  {/* Category Pills (when in grouped view) */}
                  {viewMode === 'grouped' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('ALL')}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                          selectedCategory === 'ALL'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        Tất cả ({filteredKeys.length})
                      </button>
                      {groupedPermissions.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => setSelectedCategory(group.id)}
                          className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                            selectedCategory === group.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {group.name} ({group.keys.length})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent>
              <section aria-labelledby="employee-permissions" className="space-y-4">
                {totalPermissions === 0 ? (
                  <p className="text-sm text-muted-foreground">{translate('auth.noPermissions')}</p>
                ) : filteredKeys.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-8 text-center">
                    <KeyRound className="mx-auto h-8 w-8 text-muted-foreground/60" />
                    <p className="mt-2 text-sm font-medium text-foreground">
                      Không tìm thấy quyền hạn nào
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Không có mã quyền nào khớp với từ khóa "{searchQuery}"
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="mt-3 text-xs"
                    >
                      Xóa bộ lọc
                    </Button>
                  </div>
                ) : viewMode === 'flat' ? (
                  /* Flat View: Wrap of all filtered badges */
                  <div className="flex flex-wrap gap-2">
                    {filteredKeys.map((key) => (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="max-w-full whitespace-normal break-all font-mono text-xs hover:bg-muted-foreground/20 transition-colors"
                      >
                        {key}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  /* Grouped View: Categorized domain cards */
                  <div className="space-y-4">
                    {displayedCategoryGroups.map((group) => {
                      const Icon = group.icon
                      return (
                        <div
                          key={group.id}
                          className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2.5 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={`flex h-6 w-6 items-center justify-center rounded-md border text-xs ${group.color}`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-xs font-semibold text-foreground">
                                {group.name}
                              </span>
                            </div>
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {group.keys.length} quyền
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {group.keys.map((key) => (
                              <Badge
                                key={key}
                                variant="secondary"
                                className="max-w-full whitespace-normal break-all font-mono text-xs hover:bg-muted-foreground/20 transition-colors"
                              >
                                {key}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
