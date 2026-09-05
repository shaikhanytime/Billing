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
      {/* ─── Top Promotional & Quick Feature Banners (SAP Horizon Morning Gradients) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Banner 1: Cashflo AI Collection */}
        {!banner1Dismissed && (
          <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <button
              onClick={() => setBanner1Dismissed(true)}
              className="absolute top-2.5 right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-emerald-100/60 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-1 pr-4 z-10 max-w-[70%]">
              <p className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                ₹10 Lakh+ stuck?
              </p>
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                myCashflo AI calls all of your parties, daily for automated payment collection.
              </p>
              <button
                onClick={() => navigate('/parties/customers')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#15803D] hover:text-emerald-800 hover:underline pt-1 cursor-pointer"
              >
                <span>Book demo</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* 3D Graphic */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-sm rotate-3">
                <div className="h-full w-full bg-white rounded-[14px] flex flex-col items-center justify-center text-emerald-600">
                  <PhoneCall className="h-7 w-7 text-emerald-600 animate-bounce" />
                  <span className="text-[9px] font-mono mt-0.5 font-bold text-emerald-700">AI CALLS</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Banner 2: Staff Management */}
        <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1 pr-4 z-10 max-w-[70%]">
            <p className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              Manage Staff Smarter
            </p>
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
              Track Staff's attendance, live location, orders and field activity seamlessly.
            </p>
            <button
              onClick={() => navigate('/admin/users')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#0070F2] hover:text-blue-800 hover:underline pt-1 cursor-pointer"
            >
              <span>Manage Staff Now</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Mobile App mockup graphic */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="h-16 w-14 sm:h-20 sm:w-16 rounded-xl bg-gradient-to-tr from-[#0070F2] to-indigo-500 p-0.5 shadow-sm -rotate-2">
              <div className="h-full w-full bg-white rounded-[10px] flex flex-col items-center justify-center text-[#0070F2] p-1">
                <Smartphone className="h-6 w-6 text-[#0070F2]" />
                <div className="w-6 h-1 bg-blue-400/40 rounded-full mt-1.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Business Overview Header & Metric Cards ─── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Business Overview
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Last Update: {formatDate(new Date().toISOString())} | {lastUpdated}</span>
            <button
              onClick={() => refresh()}
              disabled={isFetching}
              title="Refresh stats"
              className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
            >
              <RotateCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin text-[#0070F2]')} />
            </button>
          </div>
        </div>

        {/* 3 Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Card 1: To Collect */}
          <Link
            to="/parties/customers"
            className="group block rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7]/70 p-4 sm:p-5 transition-all shadow-xs hover:border-emerald-400"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#15803D]">
                <ArrowDownLeft className="h-4 w-4" />
                <span>To Collect</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-emerald-600/70 group-hover:text-emerald-700 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950 font-mono tracking-tight">
              {formatCurrency(toCollect)}
            </p>
          </Link>

          {/* Card 2: To Pay */}
          <Link
            to="/parties/suppliers"
            className="group block rounded-xl border border-[#FECDD3] bg-[#FFF1F2] hover:bg-[#FFE4E6]/70 p-4 sm:p-5 transition-all shadow-xs hover:border-rose-400"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#BE123C]">
                <ArrowUpRight className="h-4 w-4" />
                <span>To Pay</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-rose-600/70 group-hover:text-rose-700 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950 font-mono tracking-tight">
              {formatCurrency(toPay)}
            </p>
          </Link>

          {/* Card 3: Total Cash + Bank Balance */}
          <Link
            to="/ledger/party"
            className="group block rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE]/70 p-4 sm:p-5 transition-all shadow-xs hover:border-blue-400"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1D4ED8]">
                <Landmark className="h-4 w-4" />
                <span>Total Cash + Bank Balance</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-blue-600/70 group-hover:text-blue-700 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950 font-mono tracking-tight">
              {formatCurrency(cashBank)}
            </p>
          </Link>
        </div>
      </div>

      {/* ─── Middle Section: Latest Transactions + Today's Checklist ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2/3: Latest Transactions */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Latest Transactions</h3>
            <Link
              to="/sales/invoices"
              className="text-xs text-[#0070F2] hover:underline font-semibold"
            >
              View all
            </Link>
          </div>

          {/* Transactions Table or Empty State */}
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              {/* Clean document illustration */}
              <div className="relative flex items-center justify-center">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shadow-inner">
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#0070F2] text-white rounded-full p-1 shadow-xs">
                  <Sparkles className="h-3 w-3" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">No transactions made yet!</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create your first transaction to start seeing your data
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  to="/sales/invoices/new"
                  className="flex items-center gap-1.5 rounded-lg bg-[#0070F2] hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Sale Invoice</span>
                </Link>
                <Link
                  to="/purchases/invoices/new"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
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
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Txn No</th>
                    <th className="px-3 py-2.5">Party Name</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors text-slate-700">
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold',
                            tx.type === 'SALE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tx.type === 'PURCHASE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          )}
                        >
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-800 font-semibold whitespace-nowrap">
                        {tx.txnNo}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 truncate max-w-[140px]">
                        {tx.partyName}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
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
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Today's Checklist</h3>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Beta
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Clock className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Coming Soon...</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                Smarter daily checklist for overdue invoices and party follow-ups.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Pending follow-ups</span>
            <span className="font-bold text-slate-800 font-mono">0</span>
          </div>
        </div>
      </div>

      {/* ─── Bottom Section: Sales Report Chart ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#0070F2]" />
            <h3 className="text-sm font-bold text-slate-900">
              Sales Report - Last 7 Days
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Period selector dropdown */}
            <div className="relative">
              <select
                value={salesPeriod}
                onChange={(e) => setSalesPeriod(e.target.value as 'Daily' | 'Weekly' | 'Monthly')}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 pr-8 text-xs text-slate-700 font-semibold outline-none focus:border-[#0070F2] cursor-pointer"
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Total summary */}
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-medium">Last 7 days sales</p>
              <p className="text-sm font-bold text-slate-950 font-mono">
                {formatCurrency(last7DaysTotal)}
              </p>
            </div>
          </div>
        </div>

        {/* Chart View */}
        <div className="h-48 sm:h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#CBD5E1',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
                  color: '#1E293B',
                }}
                formatter={(val) => [formatCurrency(Number(val) || 0), 'Sales']}
              />
              <Bar dataKey="sales" fill="#0070F2" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
