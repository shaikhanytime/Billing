import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Printer, Eye, FileText, CheckCircle2, Clock } from 'lucide-react'
import { salesApi, SaleInvoice } from '../services/sales.api'
import { formatPaise, formatDate } from '@/lib/utils'

export function SalesInvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<SaleInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const data = await salesApi.getInvoices({ paymentStatus: statusFilter || undefined })
      setInvoices(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch sales invoices', err)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter])

  const safeInvoices = invoices || []
  const totalSalesPaise = safeInvoices.reduce((sum, inv) => sum + (inv.totalAmountPaise || 0), 0)
  const totalDuePaise = safeInvoices.reduce((sum, inv) => sum + (inv.balanceDuePaise || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Invoices & POS Billing</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse tax invoices, track payment receipts, and review customer billing history
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/sales/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow-md transition-all active:scale-98"
          >
            <Plus className="h-4 w-4" />
            New Invoice / POS
          </Link>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoices Generated</span>
          <div className="text-2xl font-bold text-slate-900 mt-1.5">{invoices.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Revenue</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1.5">{formatPaise(totalSalesPaise)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Outstanding Receivable</span>
          <div className="text-2xl font-bold text-amber-600 mt-1.5">{formatPaise(totalDuePaise)}</div>
        </div>
      </div>

      {/* Table Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice number or party..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
            >
              <option value="">All Payment Statuses</option>
              <option value="PAID">Fully Paid</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="UNPAID">Unpaid / Due</option>
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading sales invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No sales invoices found. Click &quot;New Invoice / POS&quot; to generate one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Tax (₹)</th>
                  <th className="py-3 px-4 text-right">Total Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.transactionId} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono font-bold text-blue-600">{inv.documentNumber}</span>
                      {inv.isPosSale && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-purple-50 text-purple-700 font-semibold">
                          POS
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {formatDate(inv.transactionDate)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{inv.partyName}</div>
                      {inv.partyGstin && <div className="text-[10px] text-slate-400 font-mono">{inv.partyGstin}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                      {formatPaise(inv.totalTaxPaise)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                      {formatPaise(inv.totalAmountPaise)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-amber-600 font-mono">
                      {formatPaise(inv.balanceDuePaise)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          inv.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : inv.paymentStatus === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => window.print()}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Print Invoice"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
