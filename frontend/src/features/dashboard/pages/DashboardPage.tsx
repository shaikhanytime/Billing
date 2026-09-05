import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  RotateCw,
  FileText,
  Plus,
  TrendingUp,
  X,
  PhoneCall,
  Smartphone,
  ChevronDown,
  Clock,
  Sparkles,
  Calendar,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface TransactionItem {
  id: string
  date: string
  type: 'SALE' | 'PURCHASE' | 'PAYMENT_IN' | 'PAYMENT_OUT'
  txnNo: string
  partyName: string
  amount: number
}

function useDashboardData() {
  const { orgId } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  const queryResult = useQuery({
    queryKey: ['mybillbook-dashboard', orgId, refreshKey],
    enabled: !!orgId,
    queryFn: async () => {
      const base = `organizations/${orgId}`

      // Parallel fetch of customers, suppliers, sales, purchases, payments
      const [customersSnap, suppliersSnap, salesSnap, purchasesSnap, paymentsSnap] =
        await Promise.all([
          getDocs(collection(db, base, 'customers')),
          getDocs(collection(db, base, 'suppliers')),
          getDocs(query(collection(db, base, 'saleInvoices'), orderBy('createdAt', 'desc'), limit(10))),
          getDocs(query(collection(db, base, 'purchaseInvoices'), orderBy('createdAt', 'desc'), limit(10))),
          getDocs(query(collection(db, base, 'paymentsReceived'), orderBy('createdAt', 'desc'), limit(10))),
        ])

      // Calculate Total to Collect (Customer dues)
      const toCollect = customersSnap.docs.reduce((sum, d) => sum + (d.data().openingBalance || 0), 0)

      // Calculate Total to Pay (Supplier payables)
      const toPay = suppliersSnap.docs.reduce((sum, d) => sum + (d.data().openingBalance || 0), 0)

      // Calculate Cash & Bank (Demo balance or calculated)
      const cashBank = 0

      // Map latest transactions
      const transactions: TransactionItem[] = []

      salesSnap.docs.forEach((d) => {
        const data = d.data()
        transactions.push({
          id: d.id,
          date: data.invoiceDate || data.createdAt || new Date().toISOString(),
          type: 'SALE',
          txnNo: data.invoiceNumber || `INV-${d.id.slice(-4)}`,
          partyName: data.customerName || 'Cash Customer',
          amount: data.totalAmount || 0,
        })
      })

      purchasesSnap.docs.forEach((d) => {
        const data = d.data()
        transactions.push({
          id: d.id,
          date: data.invoiceDate || data.createdAt || new Date().toISOString(),
          type: 'PURCHASE',
          txnNo: data.invoiceNumber || `PUR-${d.id.slice(-4)}`,
          partyName: data.supplierName || 'Supplier',
          amount: data.totalAmount || 0,
        })
      })

      paymentsSnap.docs.forEach((d) => {
        const data = d.data()
        transactions.push({
          id: d.id,
          date: data.paymentDate || data.createdAt || new Date().toISOString(),
          type: 'PAYMENT_IN',
          txnNo: data.paymentNumber || `PMT-${d.id.slice(-4)}`,
          partyName: data.customerName || 'Customer',
          amount: data.amount || 0,
        })
      })

      // Sort by date desc
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // 7-day sales chart data
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const chartData = days.map((day) => ({
        day,
        sales: 0,
      }))

      let last7DaysTotal = 0
      salesSnap.docs.forEach((d) => {
        const total = d.data().totalAmount || 0
        last7DaysTotal += total
      })

      return {
        toCollect,
        toPay,
        cashBank,
        transactions: transactions.slice(0, 6),
        chartData,
        last7DaysTotal,
        lastUpdated: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
      }
    },
    staleTime: 1000 * 60 * 2,
  })

  return {
    ...queryResult,
    refresh: () => setRefreshKey((k) => k + 1),
  }
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, isFetching, refresh } = useDashboardData()
  const [banner1Dismissed, setBanner1Dismissed] = useState(false)
  const [salesPeriod, setSalesPeriod] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily')

  const toCollect = data?.toCollect ?? 0
  const toPay = data?.toPay ?? 0
  const cashBank = data?.cashBank ?? 0
  const transactions = data?.transactions ?? []
  const chartData = data?.chartData ?? [
    { day: 'Mon', sales: 0 },
    { day: 'Tue', sales: 0 },
    { day: 'Wed', sales: 0 },
    { day: 'Thu', sales: 0 },
    { day: 'Fri', sales: 0 },
    { day: 'Sat', sales: 0 },
    { day: 'Sun', sales: 0 },
  ]
  const last7DaysTotal = data?.last7DaysTotal ?? 0
  const lastUpdated = data?.lastUpdated || '03:16 AM'

  return (
    <div className="space-y-4 sm:space-y-5 pb-8 max-w-7xl mx-auto">
      {/* ─── Top Promotional & Quick Feature Banners ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Banner 1: Cashflo AI Collection */}
        {!banner1Dismissed && (
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-gray-900 to-gray-900 p-4 sm:p-5 flex items-center justify-between shadow-sm">
            <button
              onClick={() => setBanner1Dismissed(true)}
              className="absolute top-2.5 right-2.5 p-1 rounded-full text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-1.5 pr-4 z-10 max-w-[70%]">
              <p className="text-sm sm:text-base font-bold text-white leading-tight">
                ₹10 Lakh+ stuck?
              </p>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                myCashflo AI calls all of your parties, daily for automated payment collection.
              </p>
              <button
                onClick={() => navigate('/parties/customers')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline pt-1 cursor-pointer"
              >
                <span>Book demo</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* 3D Illustration Graphics */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 rotate-3">
                <div className="h-full w-full bg-gray-900 rounded-[14px] flex flex-col items-center justify-center text-emerald-400">
                  <PhoneCall className="h-7 w-7 animate-bounce text-emerald-400" />
                  <span className="text-[9px] font-mono mt-1 font-bold text-emerald-300">AI CALLS</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Banner 2: Staff Management */}
        <div className="relative overflow-hidden rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-gray-900 to-gray-900 p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1.5 pr-4 z-10 max-w-[70%]">
            <p className="text-sm sm:text-base font-bold text-white leading-tight">
              Manage Staff Smarter
            </p>
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
              Track Staff's attendance, live location, orders and field activity seamlessly.
            </p>
            <button
              onClick={() => navigate('/admin/users')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline pt-1 cursor-pointer"
            >
              <span>Manage Staff Now</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Mobile App mockup graphic */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="h-16 w-14 sm:h-20 sm:w-16 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-lg shadow-blue-500/20 -rotate-2">
              <div className="h-full w-full bg-gray-900 rounded-[10px] flex flex-col items-center justify-center text-blue-400 p-1">
                <Smartphone className="h-6 w-6 text-blue-400" />
                <div className="w-6 h-1 bg-blue-500/40 rounded-full mt-1.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Business Overview Header & Metric Cards ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Business Overview
          </h2>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Last Update: {formatDate(new Date().toISOString())} | {lastUpdated}</span>
            <button
              onClick={() => refresh()}
              disabled={isFetching}
              title="Refresh stats"
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RotateCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin text-blue-400')} />
            </button>
          </div>
        </div>

        {/* 3 Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Card 1: To Collect */}
          <Link
            to="/parties/customers"
            className="group block rounded-xl border border-emerald-500/25 bg-emerald-950/20 hover:bg-emerald-950/30 p-4 sm:p-5 transition-all shadow-sm hover:border-emerald-500/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-400">
                <ArrowDownLeft className="h-4 w-4" />
                <span>To Collect</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-emerald-500/50 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-white font-mono tracking-tight">
              {formatCurrency(toCollect)}
            </p>
          </Link>

          {/* Card 2: To Pay */}
          <Link
            to="/parties/suppliers"
            className="group block rounded-xl border border-rose-500/25 bg-rose-950/20 hover:bg-rose-950/30 p-4 sm:p-5 transition-all shadow-sm hover:border-rose-500/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-rose-400">
                <ArrowUpRight className="h-4 w-4" />
                <span>To Pay</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-rose-500/50 group-hover:text-rose-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-white font-mono tracking-tight">
              {formatCurrency(toPay)}
            </p>
          </Link>

          {/* Card 3: Total Cash + Bank Balance */}
          <Link
            to="/ledger/party"
            className="group block rounded-xl border border-blue-500/25 bg-blue-950/20 hover:bg-blue-950/30 p-4 sm:p-5 transition-all shadow-sm hover:border-blue-500/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-400">
                <Landmark className="h-4 w-4" />
                <span>Total Cash + Bank Balance</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-blue-500/50 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-white font-mono tracking-tight">
              {formatCurrency(cashBank)}
            </p>
          </Link>
        </div>
      </div>

      {/* ─── Middle Section: Latest Transactions + Today's Checklist ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2/3: Latest Transactions */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-200">Latest Transactions</h3>
            <Link
              to="/sales/invoices"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              View all
            </Link>
          </div>

          {/* Transactions Table or Empty State */}
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              {/* Clean document illustration */}
              <div className="relative flex items-center justify-center">
                <div className="h-16 w-16 rounded-2xl bg-gray-800/80 border border-gray-700/80 flex items-center justify-center shadow-inner">
                  <FileText className="h-8 w-8 text-gray-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-1 shadow-md">
                  <Sparkles className="h-3 w-3" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-200">No transactions made yet!</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create your first transaction to start seeing your data
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  to="/sales/invoices/new"
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Sale Invoice</span>
                </Link>
                <Link
                  to="/purchases/invoices/new"
                  className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Purchase</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Txn No</th>
                    <th className="px-3 py-2.5">Party Name</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold',
                            tx.type === 'SALE'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : tx.type === 'PURCHASE'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                          )}
                        >
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-gray-300 whitespace-nowrap">
                        {tx.txnNo}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-200 truncate max-w-[140px]">
                        {tx.partyName}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-white whitespace-nowrap">
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1/3: Today's Checklist */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-200">Today's Checklist</h3>
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              Beta
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            {/* Traffic cones / coming soon illustration */}
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-200">Coming Soon...</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[200px] leading-relaxed">
                Smarter daily checklist for overdue invoices and party follow-ups.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-800/80 pt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Pending follow-ups</span>
            <span className="font-bold text-gray-400 font-mono">0</span>
          </div>
        </div>
      </div>

      {/* ─── Bottom Section: Sales Report Chart ─── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-gray-200">
              Sales Report - Last 7 Days
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Period selector dropdown */}
            <div className="relative">
              <select
                value={salesPeriod}
                onChange={(e) => setSalesPeriod(e.target.value as 'Daily' | 'Weekly' | 'Monthly')}
                className="appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 pr-8 text-xs text-gray-300 font-medium outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Total summary */}
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-medium">Last 7 days sales</p>
              <p className="text-sm font-bold text-white font-mono">
                {formatCurrency(last7DaysTotal)}
              </p>
            </div>
          </div>
        </div>

        {/* Chart View */}
        <div className="h-48 sm:h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                formatter={(val) => [formatCurrency(Number(val) || 0), 'Sales']}
              />
              <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
