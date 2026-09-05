import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/useAuth'
import {
  LayoutDashboard,
  Package,
  Tags,
  Ruler,
  Boxes,
  ClipboardList,
  FileText,
  ShoppingCart,
  RotateCcw,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Truck,
  BookOpen,
  AlertCircle,
  BarChart3,
  TrendingUp,
  BarChart2,
  Receipt,
  Settings,
  Building2,
  GitBranch,
  Warehouse,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'

interface NavItem {
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavItem[]
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
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
    label: 'Sales',
    icon: FileText,
    children: [
      { label: 'Sales Invoices', href: '/sales/invoices', icon: FileText },
      { label: 'Quotations', href: '/sales/quotations', icon: ClipboardList },
      { label: 'Sales Returns', href: '/sales/returns', icon: RotateCcw },
    ],
  },
  {
    label: 'Purchases',
    icon: ShoppingCart,
    children: [
      { label: 'Purchase Invoices', href: '/purchases/invoices', icon: ShoppingCart },
      { label: 'Purchase Returns', href: '/purchases/returns', icon: RotateCcw },
    ],
  },
  {
    label: 'Payments',
    icon: Wallet,
    children: [
      { label: 'Received', href: '/payments/received', icon: ArrowDownLeft },
      { label: 'Made', href: '/payments/made', icon: ArrowUpRight },
    ],
  },
  {
    label: 'Parties',
    icon: Users,
    children: [
      { label: 'Customers', href: '/parties/customers', icon: Users },
      { label: 'Suppliers', href: '/parties/suppliers', icon: Truck },
    ],
  },
  {
    label: 'Ledger',
    icon: BookOpen,
    children: [
      { label: 'Party Ledger', href: '/ledger/party', icon: BookOpen },
      { label: 'Outstanding', href: '/ledger/outstanding', icon: AlertCircle },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    children: [
      { label: 'Sales Report', href: '/reports/sales', icon: TrendingUp },
      { label: 'Purchase Report', href: '/reports/purchases', icon: BarChart2 },
      { label: 'Stock Report', href: '/reports/stock', icon: Boxes },
      { label: 'GST Summary', href: '/reports/gst', icon: Receipt },
    ],
  },
  {
    label: 'Administration',
    icon: Settings,
    roles: ['ADMIN', 'SUPER_ADMIN'],
    children: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Organization', href: '/admin/organization', icon: Building2 },
      { label: 'Branches', href: '/admin/branches', icon: GitBranch },
      { label: 'Warehouses', href: '/admin/warehouses', icon: Warehouse },
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
  const isActive = item.children?.some((c) => c.href && location.pathname.startsWith(c.href))
  const [open, setOpen] = useState(isActive ?? false)

  if (item.href) {
    return (
      <NavLink
        to={item.href}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 sm:py-2 text-sm font-medium transition-all duration-200 min-h-[42px] sm:min-h-0',
            isActive
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
          )
        }
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    )
  }

  if (collapsed) {
    return (
      <div className="relative group">
        <button
          className={cn(
            'flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
            isActive
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
        </button>
        {/* Tooltip */}
        <div className="absolute left-full top-0 ml-2 z-50 hidden group-hover:block">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 min-w-[160px] shadow-xl">
            <p className="text-xs font-semibold text-gray-300 px-2 py-1 mb-1">{item.label}</p>
            {item.children?.map((child) => (
              <NavLink
                key={child.href}
                to={child.href!}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
                    isActive ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
                  )
                }
              >
                <child.icon className="h-3 w-3" />
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
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 sm:py-2 text-sm font-medium transition-all duration-200 min-h-[42px] sm:min-h-0',
          isActive
            ? 'text-blue-400 font-semibold'
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
        )}
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-700/50 pl-3">
          {item.children?.map((child) => (
            <NavLink
              key={child.href}
              to={child.href!}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 min-h-[38px] sm:min-h-0',
                  isActive
                    ? 'text-blue-400 font-medium bg-blue-500/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                )
              }
            >
              <child.icon className="h-3.5 w-3.5 shrink-0" />
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const { role } = useRole()

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true
    return item.roles.includes(role ?? '')
  })

  const renderContent = (isMobile = false) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn(
        'flex items-center justify-between border-b border-gray-800 px-4',
        'h-[60px] shrink-0'
      )}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30">
            <Package className="h-4 w-4 text-white" />
          </div>
          {(!collapsed || isMobile) && (
            <div>
              <p className="text-sm font-bold text-white leading-tight">BizOps</p>
              <p className="text-[10px] text-gray-400 leading-tight">Business Platform</p>
            </div>
          )}
        </div>
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 sm:space-y-0.5 overscroll-contain">
        {filteredNav.map((item) => (
          <NavGroup
            key={item.label}
            item={item}
            collapsed={isMobile ? false : collapsed}
            onNavigate={isMobile ? onMobileClose : undefined}
          />
        ))}
      </nav>

      {/* Footer */}
      {(!collapsed || isMobile) && (
        <div className="border-t border-gray-800 px-4 py-3 shrink-0 bg-gray-900/50">
          <p className="text-[11px] text-gray-500 text-center font-medium">BizOps Platform · v1.0</p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 z-30',
          'bg-gray-900/95 border-r border-gray-800 sidebar-transition',
          collapsed ? 'w-16' : 'w-[260px]'
        )}
      >
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer (Accessible off-canvas overlay) */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-50 transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
          aria-hidden="true"
        />

        {/* Drawer panel with slide animation */}
        <aside
          className={cn(
            'fixed top-0 bottom-0 left-0 w-[280px] max-w-[85vw] flex flex-col bg-gray-900 border-r border-gray-800 shadow-2xl transition-transform duration-300 ease-in-out z-10',
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
