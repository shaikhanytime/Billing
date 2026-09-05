import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation, Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth, useRole } from '@/hooks/useAuth'
import {
  LayoutDashboard,
  Package,
  Plus,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  FileText,
  ShoppingCart,
  BarChart3,
  Landmark,
  FileCheck,
  Zap,
  Receipt,
  Monitor,
  Users,
  UserCheck,
  ShoppingBag,
  MessageSquare,
  Settings,
  ShieldCheck,
  Award,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  RotateCcw,
  Tags,
  Ruler,
  Boxes,
  Truck,
  BookOpen,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react'

interface NavChild {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
}

interface NavItem {
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavChild[]
  roles?: string[]
}

interface NavSection {
  header?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        label: 'Sales',
        icon: FileText,
        children: [
          { label: 'Sales Invoices', href: '/sales/invoices', icon: FileText },
          { label: 'Create Party', href: '/parties/customers/new', icon: Users },
          { label: 'Create Item', href: '/inventory/products/new', icon: Package },
          { label: 'Quotation', href: '/sales/quotations', icon: ClipboardList },
          { label: 'Payment In', href: '/payments/received', icon: ArrowDownLeft },
          { label: 'Sales Return', href: '/sales/returns', icon: RotateCcw },
          { label: 'Credit Note', href: '/sales/returns', icon: FileSpreadsheet },
          { label: 'Delivery Challan', href: '/sales/invoices', icon: Truck },
          { label: 'Proforma Invoice', href: '/sales/quotations', icon: FileCheck },
        ],
      },
      {
        label: 'Purchases',
        icon: ShoppingCart,
        children: [
          { label: 'Purchase Invoices', href: '/purchases/invoices', icon: ShoppingCart },
          { label: 'Payment Out', href: '/payments/made', icon: ArrowUpRight },
          { label: 'Purchase Return', href: '/purchases/returns', icon: RotateCcw },
          { label: 'Debit Note', href: '/purchases/returns', icon: FileSpreadsheet },
          { label: 'Purchase Orders', href: '/purchases/invoices', icon: ClipboardList },
          { label: 'Create Expense', href: '/purchases/invoices/new', icon: Receipt },
        ],
      },
      {
        label: 'Inventory',
        icon: Package,
        children: [
          { label: 'Products', href: '/inventory/products', icon: Package },
          { label: 'Categories', href: '/inventory/categories', icon: Tags },
          { label: 'Units', href: '/inventory/units', icon: Ruler },
          { label: 'Stock Levels', href: '/inventory/stock', icon: Boxes },
          { label: 'Stock Adjustments', href: '/inventory/adjustments', icon: ClipboardList },
        ],
      },
      {
        label: 'Reports',
        icon: BarChart3,
        children: [
          { label: 'Sales Report', href: '/reports/sales', icon: BarChart3 },
          { label: 'Purchase Report', href: '/reports/purchases', icon: BarChart3 },
          { label: 'Stock Report', href: '/reports/stock', icon: Boxes },
          { label: 'GST Summary', href: '/reports/gst', icon: Receipt },
        ],
      },
    ],
  },
  {
    header: 'ACCOUNTING SOLUTIONS',
    items: [
      { label: 'Cash & Bank', href: '/ledger/party', icon: Landmark },
      { label: 'E-Invoicing', href: '/sales/invoices', icon: FileCheck },
      { label: 'Automated Bills', href: '/sales/invoices', icon: Zap },
      { label: 'Expenses', href: '/purchases/invoices', icon: Receipt },
      { label: 'POS Billing', href: '/sales/invoices/new', icon: Monitor },
    ],
  },
  {
    header: 'BUSINESS TOOLS',
    items: [
      { label: 'Staff Attendance & Payroll', href: '/admin/users', icon: UserCheck },
      { label: 'Manage Users', href: '/admin/users', icon: Users, roles: ['ADMIN', 'SUPER_ADMIN'] },
      { label: 'Online Orders', href: '/sales/invoices', icon: ShoppingBag },
      { label: 'SMS Marketing', href: '/reports/sales', icon: MessageSquare },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

function NavGroup({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}) {
  const location = useLocation()
  const isActive = item.children?.some((c) => c.href && (location.pathname === c.href || location.pathname.startsWith(c.href + '/'))) || (item.href ? location.pathname === item.href : false)
  const [open, setOpen] = useState(isActive ?? false)

  if (item.href) {
    return (
      <NavLink
        to={item.href}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 min-h-[38px]',
            isActive
              ? 'bg-blue-600/20 text-blue-400 font-semibold'
              : 'text-gray-300 hover:bg-white/5 hover:text-white'
          )
        }
      >
        <item.icon className="h-4 w-4 shrink-0 text-gray-400" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    )
  }

  if (collapsed) {
    return (
      <div className="relative group">
        <button
          className={cn(
            'flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 min-h-[38px]',
            isActive
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
        </button>
        {/* Tooltip */}
        <div className="absolute left-full top-0 ml-2 z-50 hidden group-hover:block">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 min-w-[170px] shadow-2xl">
            <p className="text-xs font-bold text-gray-200 px-2 py-1 mb-1 border-b border-gray-700/60">{item.label}</p>
            {item.children?.map((child) => (
              <NavLink
                key={child.label + child.href}
                to={child.href}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
                    isActive ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'
                  )
                }
              >
                {child.icon && <child.icon className="h-3.5 w-3.5 shrink-0" />}
                {child.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 min-h-[38px]',
          isActive
            ? 'text-white font-semibold'
            : 'text-gray-300 hover:bg-white/5 hover:text-white'
        )}
      >
        <item.icon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="flex-1 text-left truncate">{item.label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
        )}
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-800 pl-3">
          {item.children?.map((child) => (
            <NavLink
              key={child.label + child.href}
              to={child.href}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-all duration-150 min-h-[32px]',
                  isActive
                    ? 'text-blue-400 font-medium bg-blue-500/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                )
              }
            >
              {child.icon && <child.icon className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const { user } = useAuth()
  const { role } = useRole()
  const navigate = useNavigate()
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredSections = NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((item) => {
      if (!item.roles) return true
      return item.roles.includes(role ?? '')
    }),
  })).filter((sec) => sec.items.length > 0)

  const businessName = user?.firstName ? `${user.firstName}'s Business` : 'Business Name'
  const businessInitial = businessName.charAt(0).toUpperCase() || 'B'

  const renderContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-[#0b1329] text-gray-200 select-none">
      {/* ─── Business Profile Header ─── */}
      <div className="border-b border-gray-800/80 p-3.5 sm:p-4 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Yellow Avatar Badge */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-bold text-base shadow-sm">
              {businessInitial}
            </div>
            {(!collapsed || isMobile) && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{businessName}</p>
                <p className="text-[11px] text-gray-400 truncate mt-0.5 font-mono">
                  {user?.email?.split('@')[0] || '8378845025'}
                </p>
              </div>
            )}
          </div>
          {isMobile && (
            <button
              onClick={onMobileClose}
              className="p-1 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* ─── + Create Sales Invoice Primary CTA Button ─── */}
        {(!collapsed || isMobile) && (
          <div className="mt-3.5 relative" ref={createMenuRef}>
            <div className="flex rounded-lg bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all">
              <button
                onClick={() => {
                  navigate('/sales/invoices/new')
                  if (isMobile) onMobileClose()
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-semibold text-white cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create Sales Invoice</span>
              </button>
              <button
                onClick={() => setCreateMenuOpen((o) => !o)}
                className="px-2 border-l border-indigo-500/50 text-white hover:bg-indigo-700/50 rounded-r-lg transition-colors"
                aria-label="More create options"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Dropdown menu */}
            {createMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-1.5 space-y-0.5">
                {[
                  { label: 'Sales Invoice', href: '/sales/invoices/new', icon: FileText },
                  { label: 'Quotation / Estimate', href: '/sales/quotations', icon: ClipboardList },
                  { label: 'Payment In', href: '/payments/received', icon: ArrowDownLeft },
                  { label: 'Sales Return', href: '/sales/returns', icon: RotateCcw },
                  { label: 'Delivery Challan', href: '/sales/invoices', icon: Truck },
                  { label: 'Credit Note', href: '/sales/returns', icon: FileSpreadsheet },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      navigate(item.href)
                      setCreateMenuOpen(false)
                      if (isMobile) onMobileClose()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white text-left transition-colors"
                  >
                    <item.icon className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Navigation Links ─── */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 overscroll-contain custom-scrollbar">
        {filteredSections.map((sec, idx) => (
          <div key={sec.header || idx} className="space-y-0.5">
            {sec.header && (!collapsed || isMobile) && (
              <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {sec.header}
              </p>
            )}
            {sec.items.map((item) => (
              <NavGroup
                key={item.label}
                item={item}
                collapsed={isMobile ? false : collapsed}
                onNavigate={isMobile ? onMobileClose : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* ─── Bottom Settings & Trust Badge ─── */}
      <div className="border-t border-gray-800/80 p-2.5 shrink-0 bg-[#090f20]">
        <NavLink
          to="/admin/organization"
          onClick={isMobile ? onMobileClose : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-2',
              isActive
                ? 'bg-blue-600/20 text-blue-400 font-semibold'
                : 'text-gray-300 hover:bg-white/5 hover:text-white'
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0 text-gray-400" />
          {(!collapsed || isMobile) && <span>Settings</span>}
        </NavLink>

        {(!collapsed || isMobile) && (
          <div className="flex items-center justify-center gap-3 py-1 px-2 text-[10px] text-gray-400 border-t border-gray-800/50">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              100% Secure
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Award className="h-3 w-3 text-blue-400" />
              ISO Certified
            </span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 z-30',
          'border-r border-gray-800/80 sidebar-transition',
          collapsed ? 'w-16' : 'w-[250px]'
        )}
      >
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-50 transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
          aria-hidden="true"
        />
        <aside
          className={cn(
            'fixed top-0 bottom-0 left-0 w-[270px] max-w-[85vw] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out z-10',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {renderContent(true)}
        </aside>
      </div>
    </>
  )
}

export function SidebarToggle({
  collapsed,
  onToggle,
  onMobileOpen,
}: {
  collapsed: boolean
  onToggle: () => void
  onMobileOpen: () => void
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className="hidden lg:flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>
      <button
        onClick={onMobileOpen}
        className="flex lg:hidden items-center justify-center h-9 w-9 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white active:scale-95 transition-all"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  )
}
