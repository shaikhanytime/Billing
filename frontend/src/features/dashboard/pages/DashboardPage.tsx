import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/common/StatCard'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  Users,
  Package,
  TrendingUp,
  ShoppingCart,
  AlertCircle,
  Building2,
  Warehouse,
  UserCheck,
  ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

function useStats() {
  const { orgId } = useAuth()

  return useQuery({
    queryKey: ['dashboard-stats', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const base = `organizations/${orgId}`

      // Run parallel fetches
      const [usersSnap, productsSnap, customersSnap, suppliersSnap, branchesSnap, warehousesSnap] =
        await Promise.all([
          getDocs(collection(db, base, 'users')),
          getDocs(collection(db, base, 'products')),
          getDocs(collection(db, base, 'customers')),
          getDocs(collection(db, base, 'suppliers')),
          getDocs(collection(db, base, 'branches')),
          getDocs(collection(db, base, 'warehouses')),
        ])

      const users = usersSnap.docs.map((d) => d.data())
      const products = productsSnap.docs.map((d) => d.data())

      // Today's sales total
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const salesSnap = await getDocs(
        query(
          collection(db, base, 'saleInvoices'),
          where('createdAt', '>=', Timestamp.fromDate(today))
        )
      )
      const todaySales = salesSnap.docs.reduce((sum, d) => sum + (d.data().totalAmount ?? 0), 0)

      const purchasesSnap = await getDocs(
        query(
          collection(db, base, 'purchaseInvoices'),
          where('createdAt', '>=', Timestamp.fromDate(today))
        )
      )
      const todayPurchases = purchasesSnap.docs.reduce((sum, d) => sum + (d.data().totalAmount ?? 0), 0)

      // Low stock
      const stockSnap = await getDocs(collection(db, base, 'stock'))
      const lowStock = stockSnap.docs.filter((d) => {
        const s = d.data()
        return s.quantityOnHand <= s.reorderLevel
      })

      return {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.status === 'ACTIVE').length,
        totalProducts: products.length,
        totalCustomers: customersSnap.size,
        totalSuppliers: suppliersSnap.size,
        totalBranches: branchesSnap.size,
        totalWarehouses: warehousesSnap.size,
        todaySales,
        todayPurchases,
        lowStockCount: lowStock.length,
      }
    },
    staleTime: 1000 * 60 * 2,
  })
}

function useRecentActivity() {
  const { orgId } = useAuth()
  return useQuery({
    queryKey: ['recent-activity', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(db, 'organizations', orgId!, 'auditLogs'),
          orderBy('createdAt', 'desc'),
          limit(8)
        )
      )
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    },
  })
}

const ACTION_LABELS: Record<string, string> = {
  USER_CREATED: 'New user created',
  USER_UPDATED: 'User updated',
  PRODUCT_CREATED: 'Product added',
  PRODUCT_UPDATED: 'Product updated',
  SALE_INVOICE_CREATED: 'Sale invoice created',
  PURCHASE_INVOICE_CREATED: 'Purchase invoice created',
  PAYMENT_RECEIVED: 'Payment received',
  PAYMENT_MADE: 'Payment made',
  STOCK_ADJUSTED: 'Stock adjusted',
  LOGIN_SUCCESS: 'User logged in',
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data: stats, isLoading } = useStats()
  const { data: activity } = useRecentActivity()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">
            {greeting()}, {user?.firstName}! 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Here's what's happening with your business today.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/sales/invoices/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            New Sale
          </Link>
          <Link
            to="/purchases/invoices/new"
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            New Purchase
          </Link>
        </div>
      </div>

      {/* Today's Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={stats?.todaySales ?? 0}
          currency
          icon={TrendingUp}
          color="green"
          subtitle="All invoices today"
        />
        <StatCard
          title="Today's Purchases"
          value={stats?.todayPurchases ?? 0}
          currency
          icon={ShoppingCart}
          color="blue"
          subtitle="All purchases today"
        />
        <StatCard
          title="Total Products"
          value={isLoading ? '—' : stats?.totalProducts ?? 0}
          icon={Package}
          color="purple"
          subtitle={`${stats?.lowStockCount ?? 0} low stock`}
        />
        <StatCard
          title="Low Stock Alerts"
          value={isLoading ? '—' : stats?.lowStockCount ?? 0}
          icon={AlertCircle}
          color="red"
          subtitle="Below reorder level"
        />
      </div>

      {/* Business Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Customers" value={isLoading ? '—' : stats?.totalCustomers ?? 0} icon={Users} color="blue" />
        <StatCard title="Suppliers" value={isLoading ? '—' : stats?.totalSuppliers ?? 0} icon={Building2} color="amber" />
        <StatCard title="Active Users" value={isLoading ? '—' : stats?.activeUsers ?? 0} icon={UserCheck} color="green" />
        <StatCard title="Warehouses" value={isLoading ? '—' : stats?.totalWarehouses ?? 0} icon={Warehouse} color="purple" />
      </div>

      {/* Bottom: Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'New Sale Invoice', href: '/sales/invoices/new', icon: TrendingUp, color: 'text-green-400' },
              { label: 'New Purchase', href: '/purchases/invoices/new', icon: ShoppingCart, color: 'text-blue-400' },
              { label: 'Add Product', href: '/inventory/products/new', icon: Package, color: 'text-purple-400' },
              { label: 'Add Customer', href: '/parties/customers/new', icon: Users, color: 'text-amber-400' },
              { label: 'Receive Payment', href: '/payments/received/new', icon: TrendingUp, color: 'text-emerald-400' },
              { label: 'Stock Adjustment', href: '/inventory/adjustments/new', icon: Package, color: 'text-red-400' },
            ].map((a) => (
              <Link
                key={a.href}
                to={a.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors group"
              >
                <a.icon className={`h-4 w-4 ${a.color}`} />
                <span className="flex-1">{a.label}</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Recent Activity</h2>
            <Link to="/admin/users" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View all
            </Link>
          </div>
          {!activity || activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-600">
              <Package className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((log: Record<string, unknown>) => (
                <div key={log.id as string} className="flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 shrink-0 flex items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
                    <Package className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">
                      {ACTION_LABELS[log.action as string] ?? log.action as string}
                    </p>
                    {log['entityType'] != null && (
                      <p className="text-xs text-gray-600 truncate">
                        {String(log['entityType'])} {log['entityId'] ? `· #${String(log['entityId']).slice(-8)}` : ''}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-[10px] text-gray-600 mt-0.5">
                    {log.createdAt ? formatDateTime((log.createdAt as { toDate(): Date }).toDate?.() ?? log.createdAt as string) : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
