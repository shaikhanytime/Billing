import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FileText } from 'lucide-react'
import { purchasesApi, PurchaseInvoice } from '../services/purchases.api'
import { formatPaise, formatDate } from '@/lib/utils'

export function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const data = await purchasesApi.getInvoices()
      setInvoices(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch purchase invoices', err)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const safeInvoices = invoices || []
  const totalPurchasesPaise = safeInvoices.reduce((sum, inv) => sum + (inv.totalAmountPaise || 0), 0)
  const totalPayablePaise = safeInvoices.reduce((sum, inv) => sum + (inv.balanceDuePaise || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Bills & Inward Goods</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track inward vendor bills, purchase tax credits (ITC), and supplier payables
          </p>
        </div>
        <Link
          to="/purchases/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow-md transition-all active:scale-98"
        >
          <Plus className="h-4 w-4" />
          Record Purchase Bill
        </Link>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchase Bills</span>
          <div className="text-2xl font-bold text-slate-900 mt-1.5">{invoices.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Purchases</span>
          <div className="text-2xl font-bold text-slate-900 mt-1.5">{formatPaise(totalPurchasesPaise)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Supplier Payable</span>
          <div className="text-2xl font-bold text-red-600 mt-1.5">{formatPaise(totalPayablePaise)}</div>
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
              placeholder="Search by vendor bill number or supplier..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
        </div>

        {/* Purchase Invoices Table */}
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading purchase bills...</div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No purchase bills recorded. Click &quot;Record Purchase Bill&quot; to add inward stock.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Internal Ref #</th>
                  <th className="py-3 px-4">Vendor Bill #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-right">Tax (₹)</th>
                  <th className="py-3 px-4 text-right">Total Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.transactionId} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-bold text-blue-600">{inv.documentNumber}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 font-semibold">{inv.vendorBillNumber}</td>
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
                    <td className="py-3.5 px-4 text-right font-bold text-red-600 font-mono">
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
