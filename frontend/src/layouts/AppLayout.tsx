import { useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/auth.store'
import { Sidebar, SidebarToggle } from './Sidebar'
import { cn, getInitials } from '@/lib/utils'
import {
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Home,
  ChevronRight,
  Monitor,
  Megaphone,
  Gift,
  Headphones,
  Smartphone,
  Calculator,
} from 'lucide-react'

function useBreadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    products: 'Products',
    categories: 'Categories',
    units: 'Units',
    stock: 'Stock',
    adjustments: 'Adjustments',
    sales: 'Sales',
    invoices: 'Invoices',
    quotations: 'Quotations',
    returns: 'Returns',
    purchases: 'Purchases',
    payments: 'Payments',
    received: 'Received',
    made: 'Made',
    parties: 'Parties',
    customers: 'Customers',
    suppliers: 'Suppliers',
    ledger: 'Ledger',
    party: 'Party Ledger',
    outstanding: 'Outstanding',
    reports: 'Reports',
    gst: 'GST Summary',
    admin: 'Administration',
    users: 'Users',
    organization: 'Organization',
    branches: 'Branches',
    warehouses: 'Warehouses',
    new: 'New',
    edit: 'Edit',
  }

  return segments.map((seg, i) => ({
    label: labels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }))
}

function TopNav({
  collapsed,
  onToggle,
  onMobileOpen,
}: {
  collapsed: boolean
  onToggle: () => void
  onMobileOpen: () => void
}) {
  const { user } = useAuth()
  const { logout } = useAuthStore()
  const breadcrumbs = useBreadcrumbs()
  const [profileOpen, setProfileOpen] = useState(false)

  async function handleLogout() {
    await signOut(auth)
    logout()
  }

  const currentCrumb = breadcrumbs[breadcrumbs.length - 1]

  return (
    <header className="sticky top-0 z-30 flex h-[58px] items-center gap-3 border-b border-slate-200 bg-white shadow-xs px-3 sm:px-4 lg:px-6">
      {/* Sidebar toggle */}
      <SidebarToggle
        collapsed={collapsed}
        onToggle={onToggle}
        onMobileOpen={onMobileOpen}
      />

      {/* Main Title / Breadcrumbs */}
      <div className="flex items-center min-w-0">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          {currentCrumb ? currentCrumb.label : 'Dashboard'}
        </h1>
      </div>

      {/* Right Top Action & Utility Icons */}
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        {/* Desktop / POS View */}
        <button
          title="POS / Desktop Mode"
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Monitor className="h-4 w-4" />
        </button>

        {/* Announcements */}
        <button
          title="Updates & Announcements"
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Megaphone className="h-4 w-4" />
        </button>

        {/* Rewards / Offers */}
        <button
          title="Rewards & Referrals"
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Gift className="h-4 w-4" />
        </button>

        {/* Help & Support */}
        <button
          title="Customer Support"
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Headphones className="h-4 w-4" />
        </button>

        {/* Mobile App */}
        <button
          title="Get Mobile App"
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Smartphone className="h-4 w-4" />
        </button>

        {/* Calculator */}
        <button
          title="Calculator & Tools"
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Calculator className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <button
          title="Notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#0070F2]" />
        </button>

        {/* Profile menu */}
        <div className="relative ml-1">
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg p-1 sm:px-2 sm:py-1 hover:bg-slate-100 transition-colors"
            aria-label="User profile"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-xs font-bold shrink-0">
              {user ? getInitials(user.firstName, user.lastName) : 'U'}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 hidden sm:block" />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-20 w-56 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 bg-white shadow-xl py-1 text-slate-800">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    to="/admin/users"
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition-colors"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    Profile
                  </Link>
                  <Link
                    to="/admin/organization"
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    Settings
                  </Link>
                </div>
                <div className="border-t border-slate-100 py-1">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer font-medium"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#F5F7FB]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0 bg-[#F5F7FB]">
        <TopNav
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onMobileOpen={() => setMobileOpen(true)}
        />
        <main className={cn('flex-1 p-3.5 sm:p-4 lg:p-6 pb-12 sm:pb-6 page-enter min-w-0 bg-[#F5F7FB]')}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
