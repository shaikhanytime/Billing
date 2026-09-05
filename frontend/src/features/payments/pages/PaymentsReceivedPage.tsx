import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Loader2,
  FileText,
} from 'lucide-react'
import { paymentsApi, PaymentVoucher } from '../services/payments.api'
import { formatPaise, formatDate } from '@/lib/utils'

export function PaymentsReceivedPage() {
  const [payments, setPayments] = useState<PaymentVoucher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Modals
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<PaymentVoucher | null>(null)
  const [selectedVoucherForReverse, setSelectedVoucherForReverse] = useState<PaymentVoucher | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseLoading, setReverseLoading] = useState(false)
  const [reverseError, setReverseError] = useState<string | null>(null)

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const data = await paymentsApi.getPayments({
        type: 'PAYMENT_IN',
        paymentMode: modeFilter || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      })
      setPayments(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch payments received', err)
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [modeFilter, statusFilter])

  const handleReverse = async () => {
    if (!selectedVoucherForReverse) return
    setReverseLoading(true)
    setReverseError(null)

    try {
      await paymentsApi.reversePayment(selectedVoucherForReverse.transactionId, reverseReason)
      setSelectedVoucherForReverse(null)
      setReverseReason('')
      await fetchPayments()
    } catch (err: any) {
      setReverseError(err.response?.data?.error || err.message || 'Failed to reverse payment voucher.')
    } finally {
      setReverseLoading(false)
    }
  }

  const safePayments = payments || []
  const filteredPayments = safePayments.filter((p) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      p.documentNumber.toLowerCase().includes(s) ||
      p.partyName.toLowerCase().includes(s) ||
      (p.referenceNumber && p.referenceNumber.toLowerCase().includes(s))
    )
  })

  const totalReceivedPaise = safePayments
    .filter((p) => p.status === 'POSTED')
    .reduce((sum, p) => sum + (p.paymentAmountPaise || p.totalAmount || 0), 0)

  const totalDiscountPaise = safePayments
    .filter((p) => p.status === 'POSTED')
    .reduce((sum, p) => sum + (p.discountPaise || p.discountAmount || 0), 0)

  const totalAdvancePaise = safePayments
    .filter((p) => p.status === 'POSTED')
    .reduce((sum, p) => sum + (p.unallocatedPaymentAmountPaise || p.unallocatedAmount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments Received (Customer Receipts)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track customer receipts, apply invoice settlements & settlement discounts, and manage advance balances
          </p>
        </div>
        <Link
          to="/payments/received/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow-md transition-all active:scale-98"
        >
          <Plus className="h-4 w-4" />
          Receive Payment
        </Link>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Receipts</span>
          <div className="text-2xl font-bold text-slate-900 mt-1.5">{safePayments.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cash Collected</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1.5">{formatPaise(totalReceivedPaise)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Settlement Discounts</span>
          <div className="text-2xl font-bold text-blue-600 mt-1.5">{formatPaise(totalDiscountPaise)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unallocated Advances</span>
          <div className="text-2xl font-bold text-purple-600 mt-1.5">{formatPaise(totalAdvancePaise)}</div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by voucher #, customer, reference..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
            >
              <option value="">All Payment Modes</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="POSTED">Posted</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Loading customer payments...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No customer payment receipts found. Click &quot;Receive Payment&quot; to record one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Receipt #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Mode / Ref</th>
                  <th className="py-3 px-4 text-right">Physical Cash (₹)</th>
                  <th className="py-3 px-4 text-right">Discount (₹)</th>
                  <th className="py-3 px-4 text-right">Total Settled (₹)</th>
                  <th className="py-3 px-4 text-right">Advance (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => {
                  const cash = p.paymentAmountPaise || p.totalAmount || 0
                  const disc = p.discountPaise || p.discountAmount || 0
                  const settled = p.settlementAmountPaise || cash + disc
                  const adv = p.unallocatedPaymentAmountPaise || p.unallocatedAmount || 0

                  return (
                    <tr key={p.transactionId} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-blue-600">{p.documentNumber}</td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{formatDate(p.transactionDate)}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{p.partyName}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{p.paymentMode}</div>
                        {p.referenceNumber && (
                          <div className="text-[10px] text-slate-400 font-mono">Ref: {p.referenceNumber}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatPaise(cash)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-blue-600">
                        {disc > 0 ? formatPaise(disc) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatPaise(settled)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-purple-600">
                        {adv > 0 ? formatPaise(adv) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            p.status === 'POSTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print Receipt */}
                          <button
                            onClick={() => setSelectedVoucherForPrint(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Print Receipt"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          {/* Reverse Voucher */}
                          {p.status === 'POSTED' && (
                            <button
                              onClick={() => {
                                setSelectedVoucherForReverse(p)
                                setReverseError(null)
                                setReverseReason('')
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reverse Payment"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reversal Confirmation Modal */}
      {selectedVoucherForReverse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="h-9 w-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reverse Payment Voucher</h3>
                <p className="text-xs text-slate-500">
                  {selectedVoucherForReverse.documentNumber} — {selectedVoucherForReverse.partyName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Reversing this receipt will restore all invoice balances, update customer receivables in the Party Ledger,
              and cancel unallocated advances.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Reversal</label>
              <input
                type="text"
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="e.g. Bounced cheque, incorrect amount..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
              />
            </div>

            {reverseError && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700">
                {reverseError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedVoucherForReverse(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reverseLoading}
                onClick={handleReverse}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                {reverseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Preview Modal */}
      {selectedVoucherForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 space-y-6 my-8 print:m-0 print:p-0">
            {/* Print Header Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Customer Payment Receipt Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Receipt
                </button>
                <button
                  onClick={() => setSelectedVoucherForPrint(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="space-y-6 border border-slate-200 p-8 rounded-xl bg-white">
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">PAYMENT RECEIPT</h2>
                  <p className="text-xs text-slate-500 font-semibold mt-1">OFFICIAL ACKNOWLEDGMENT OF FUNDS RECEIVED</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-blue-600">
                    {selectedVoucherForPrint.documentNumber}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Date: <span className="font-semibold">{formatDate(selectedVoucherForPrint.transactionDate)}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Mode: <span className="font-semibold">{selectedVoucherForPrint.paymentMode}</span>
                  </div>
                  {selectedVoucherForPrint.referenceNumber && (
                    <div className="text-xs text-slate-600">
                      Ref: <span className="font-mono font-semibold">{selectedVoucherForPrint.referenceNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Received From */}
              <div className="border-b border-slate-200 pb-4 text-xs">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Received From:</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedVoucherForPrint.partyName}</div>
              </div>

              {/* Allocations Table */}
              {selectedVoucherForPrint.allocations && selectedVoucherForPrint.allocations.length > 0 ? (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Settlement Breakdown
                  </h4>
                  <table className="w-full text-left text-xs border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                        <th className="py-2 px-3">Invoice #</th>
                        <th className="py-2 px-3 text-right">Physical Payment (₹)</th>
                        <th className="py-2 px-3 text-right">Discount (₹)</th>
                        <th className="py-2 px-3 text-right">Total Settled (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedVoucherForPrint.allocations.map((a, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono font-semibold text-blue-600">{a.invoiceNumber}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatPaise(a.paymentAllocatedPaise || a.allocatedAmount || 0)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-blue-600">
                            {formatPaise(a.discountAllocatedPaise || 0)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatPaise(a.settlementAllocatedPaise || a.allocatedAmount || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {/* Totals */}
              <div className="flex justify-end pt-4 border-t border-slate-200">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Physical Cash Received:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {formatPaise(selectedVoucherForPrint.paymentAmountPaise || selectedVoucherForPrint.totalAmount || 0)}
                    </span>
                  </div>
                  {selectedVoucherForPrint.discountPaise ? (
                    <div className="flex justify-between text-blue-600">
                      <span>Settlement Discount:</span>
                      <span className="font-mono">
                        {formatPaise(selectedVoucherForPrint.discountPaise || selectedVoucherForPrint.discountAmount || 0)}
                      </span>
                    </div>
                  ) : null}
                  {(selectedVoucherForPrint.unallocatedPaymentAmountPaise || selectedVoucherForPrint.unallocatedAmount || 0) > 0 ? (
                    <div className="flex justify-between text-purple-600">
                      <span>Unallocated Advance:</span>
                      <span className="font-mono font-semibold">
                        {formatPaise(
                          selectedVoucherForPrint.unallocatedPaymentAmountPaise ||
                            selectedVoucherForPrint.unallocatedAmount ||
                            0
                        )}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-2 border-t border-slate-300 font-bold text-sm text-slate-900">
                    <span>Total Liability Settled:</span>
                    <span className="font-mono font-extrabold text-blue-600">
                      {formatPaise(
                        selectedVoucherForPrint.settlementAmountPaise ||
                          (selectedVoucherForPrint.paymentAmountPaise || selectedVoucherForPrint.totalAmount || 0) +
                            (selectedVoucherForPrint.discountPaise || selectedVoucherForPrint.discountAmount || 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signature block */}
              <div className="pt-12 flex justify-between text-xs text-slate-400">
                <div>Customer Signature</div>
                <div>Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
