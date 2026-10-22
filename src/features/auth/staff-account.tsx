import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getPermissionLabel } from '../../shared/auth/permission-label'
import { useOutletContext } from 'react-router-dom'
import {
  Banknote,
  ChefHat,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  KeyRound,
  Lock,
  Package,
  Search,
  Settings,
  Shield,
  Store,
  User,
  Users2,
  UtensilsCrossed,
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
  bgLight: string
  match: (key: string) => boolean
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'pos',
    name: 'Bán hàng & POS',
    icon: UtensilsCrossed,
    color: 'text-amber-700 dark:text-amber-400',
    bgLight: 'bg-amber-500/10 border-amber-500/20',
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
    color: 'text-rose-700 dark:text-rose-400',
    bgLight: 'bg-rose-500/10 border-rose-500/20',
    match: (k) => k.startsWith('/kitchen') || k.startsWith('/kds'),
  },
  {
    id: 'cashier',
    name: 'Thu ngân & Ca làm việc',
    icon: Banknote,
    color: 'text-emerald-700 dark:text-emerald-400',
    bgLight: 'bg-emerald-500/10 border-emerald-500/20',
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
    color: 'text-blue-700 dark:text-blue-400',
    bgLight: 'bg-blue-500/10 border-blue-500/20',
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
    color: 'text-purple-700 dark:text-purple-400',
    bgLight: 'bg-purple-500/10 border-purple-500/20',
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
    color: 'text-indigo-700 dark:text-indigo-400',
    bgLight: 'bg-indigo-500/10 border-indigo-500/20',
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
    color: 'text-slate-700 dark:text-slate-300',
    bgLight: 'bg-slate-500/10 border-slate-500/20',
    match: (k) =>
      k.startsWith('/auth') ||
      k.startsWith('/settings') ||
      k.startsWith('/system') ||
      k.startsWith('/stores') ||
      k.startsWith('/printing'),
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
  const { t: translate, i18n } = useTranslation()
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const { employee, authorization } = useOutletContext<Session>()
  const totalPermissions = authorization.permissionKeys.length

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped')
  // Track open accordion state per category (defaults to all open)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  const toggleCategoryCollapse = (id: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Filter permission keys by search query
  const filteredKeys = useMemo(() => {
    const keys = authorization.permissionKeys
    if (!searchQuery.trim()) return keys
    const q = searchQuery.toLowerCase().trim()
    return keys.filter((k) => `${k} ${getPermissionLabel(k, language)}`.toLowerCase().includes(q))
  }, [authorization.permissionKeys, searchQuery, language])

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
        color: 'text-muted-foreground',
        bgLight: 'bg-muted border-border',
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
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Profile Hero Card */}
      <Card className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-[#062F29] text-xl sm:text-2xl font-bold text-white shadow-sm ring-4 ring-primary/10">
              {initials}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
                  {employee.fullName}
                </h1>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold text-xs gap-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Đang hoạt động
                </Badge>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground">
                Tài khoản nhân viên hệ thống Coffee Homes · @{employee.username}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {employee.position?.name && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold text-xs"
                  >
                    {employee.position.name}
                  </Badge>
                )}
                {authorization.roleNames.map((role) => (
                  <Badge
                    key={role}
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-primary font-semibold text-xs font-mono"
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 border-t border-border/70 pt-4 md:border-t-0 md:pt-0 text-xs">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Mã nhân viên
              </span>
              <span className="font-mono font-semibold text-foreground truncate block mt-0.5">
                {employee.id.slice(0, 8)}...
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Chi nhánh làm việc
              </span>
              <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                <Store className="h-3 w-3 text-primary shrink-0" />
                Chi nhánh trung tâm
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Account Details & Security (~35% -> 5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Employee Details Card */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <h2 id="employee-information">{translate('auth.employeeDetails')}</h2>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <section aria-labelledby="employee-information">
                <dl className="space-y-3.5 divide-y divide-border/60">
                  {/* Email */}
                  <div className="min-w-0 pt-2 first:pt-0">
                    <dt className="text-xs font-medium text-muted-foreground">Email</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-foreground break-all">
                      {employee.email}
                    </dd>
                  </div>

                  {/* Username */}
                  <div className="pt-3">
                    <dt className="text-xs font-medium text-muted-foreground">Tên đăng nhập</dt>
                    <dd className="mt-0.5 font-mono text-xs font-semibold text-foreground">
                      @{employee.username}
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
                    <dd className="mt-0.5 text-sm font-semibold text-foreground break-words">
                      {authorization.roleNames.join(', ') || translate('common.unassigned')}
                    </dd>
                  </div>

                  {/* Working Branch */}
                  <div className="pt-3">
                    <dt className="text-xs font-medium text-muted-foreground">Chi nhánh</dt>
                    <dd className="mt-0.5 text-xs font-medium text-foreground">
                      Chi nhánh trung tâm (Trụ sở chính)
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

          {/* Security Card: Google OAuth & Security */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lock className="h-4 w-4" />
                </div>
                Bảo mật &amp; Liên kết tài khoản
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <GoogleAccount linked={employee.googleLinked} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Permissions Matrix (~65% -> 7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-base font-bold text-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Shield className="h-4 w-4" />
                    </div>
                    <h2 id="employee-permissions">
                      Quyền hạn được cấp ({totalPermissions})
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Danh mục mã phân quyền kỹ thuật đã được phân bổ cho vai trò của bạn
                  </p>
                </div>

                {/* View Mode Switcher */}
                <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('grouped')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      viewMode === 'grouped'
                        ? 'bg-[#062F29] text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Theo nhóm
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('flat')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      viewMode === 'flat'
                        ? 'bg-[#062F29] text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tất cả
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              {totalPermissions > 0 && (
                <div className="mt-4 space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Tìm kiếm mã quyền, tên quyền hoặc mô tả..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-9 text-xs bg-background"
                    />
                  </div>

                  {/* Category Filter Pills */}
                  {viewMode === 'grouped' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('ALL')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          selectedCategory === 'ALL'
                            ? 'bg-[#062F29] text-white shadow-xs'
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
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            selectedCategory === group.id
                              ? 'bg-[#062F29] text-white shadow-xs'
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

            <CardContent className="pt-5">
              <section aria-labelledby="employee-permissions" className="space-y-4">
                {totalPermissions === 0 ? (
                  <p className="text-sm text-muted-foreground">{translate('auth.noPermissions')}</p>
                ) : filteredKeys.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                    <KeyRound className="mx-auto h-8 w-8 text-muted-foreground/60" />
                    <p className="mt-2 text-sm font-semibold text-foreground">
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
                      <span
                        key={key}
                        className="text-xs px-2.5 py-1 rounded-lg bg-muted/60 border border-border/70 text-foreground hover:bg-muted transition-colors break-words"
                      >
                        {getPermissionLabel(key, language)}
                      </span>
                    ))}
                  </div>
                ) : (
                  /* Grouped View: Categorized domain cards with accordion */
                  <div className="space-y-3.5">
                    {displayedCategoryGroups.map((group) => {
                      const Icon = group.icon
                      const isCollapsed = Boolean(collapsedCategories[group.id])

                      return (
                        <div
                          key={group.id}
                          className="rounded-2xl border border-border/80 bg-card p-4 transition-all shadow-2xs hover:border-primary/30"
                        >
                          <div
                            className="flex items-center justify-between cursor-pointer select-none"
                            onClick={() => toggleCategoryCollapse(group.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-bold ${group.bgLight} ${group.color}`}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="text-sm font-bold text-foreground">
                                  {group.name}
                                </span>
                                <span className="text-xs text-muted-foreground block font-normal">
                                  {group.keys.length} quyền khả dụng
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[11px] font-mono font-semibold"
                              >
                                {group.keys.length}
                              </Badge>
                              <button
                                type="button"
                                aria-label={isCollapsed ? 'Mở rộng nhóm' : 'Thu gọn nhóm'}
                                className="text-muted-foreground hover:text-foreground p-1"
                              >
                                {isCollapsed ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronUp className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="mt-3.5 pt-3 border-t border-border/60 flex flex-wrap gap-1.5">
                              {group.keys.map((key) => (
                                <span
                                  key={key}
                                  className="text-[11px] px-2 py-1 rounded-md bg-muted/50 border border-border/60 text-foreground/90 hover:bg-muted transition-colors break-words"
                                >
                                  {getPermissionLabel(key, language)}
                                </span>
                              ))}
                            </div>
                          )}
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
