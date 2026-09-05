import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Loader2,
  FileText,
} from 'lucide-react'
import { paymentsApi, PaymentVoucher } from '../services/payments.api'
import { formatPaise, formatDate } from '@/lib/utils'

export function PaymentsMadePage() {
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
        type: 'PAYMENT_OUT',
        paymentMode: modeFilter || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      })
      setPayments(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch payments made', err)
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

  const totalPaidPaise = safePayments
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments Made (Supplier Disbursements)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track disbursements, vendor bill settlements, purchase discounts, and advance payments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/payments/made/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Make Payment
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Disbursements</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{formatPaise(totalPaidPaise)}</div>
          <p className="text-xs text-slate-500 mt-1">Total physical payment disbursed to suppliers</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Discounts Received</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{formatPaise(totalDiscountPaise)}</div>
          <p className="text-xs text-slate-500 mt-1">Total early/settlement discount earned</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Unallocated Advances</span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{formatPaise(totalAdvancePaise)}</div>
          <p className="text-xs text-slate-500 mt-1">Available advance balance for future bills</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by voucher #, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">All Modes</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="ALL">All Status</option>
            <option value="POSTED">Posted</option>
            <option value="REVERSED">Reversed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-900">No disbursements found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {search || modeFilter || statusFilter !== 'ALL'
                ? 'Try adjusting your filters or search query.'
                : 'Record your first supplier disbursement to begin tracking purchase payments.'}
            </p>
            {!search && !modeFilter && statusFilter === 'ALL' && (
              <div className="mt-5">
                <Link
                  to="/payments/made/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Make Payment
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Paid Amount</th>
                  <th className="py-3 px-4 text-right">Discount</th>
                  <th className="py-3 px-4 text-right">Advance Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => {
                  const paid = p.paymentAmountPaise || p.totalAmount || 0
                  const discount = p.discountPaise || p.discountAmount || 0
                  const advance = p.unallocatedPaymentAmountPaise || p.unallocatedAmount || 0
                  const isReversed = p.status === 'REVERSED'

                  return (
                    <tr
                      key={p.transactionId}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isReversed ? 'bg-rose-50/30 opacity-75' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {formatDate(p.transactionDate)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {p.documentNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-medium whitespace-nowrap">
                        {p.partyName}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {p.paymentMode}
                        </span>
                        {p.referenceNumber && (
                          <span className="block text-[11px] font-mono text-slate-400 mt-0.5">
                            Ref: {p.referenceNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatPaise(paid)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600 whitespace-nowrap">
                        {discount > 0 ? (
                          <span className="text-blue-600 font-medium">+{formatPaise(discount)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {advance > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                            {formatPaise(advance)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isReversed ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                            REVERSED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            POSTED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedVoucherForPrint(p)}
                            title="View / Print Voucher"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          {!isReversed && (
                            <button
                              onClick={() => {
                                setSelectedVoucherForReverse(p)
                                setReverseReason('')
                                setReverseError(null)
                              }}
                              title="Reverse Payment"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
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

      {/* Print Voucher Modal */}
      {selectedVoucherForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Payment Voucher</h3>
                <p className="text-xs text-slate-500">Official Supplier Disbursement Slip</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </button>
                <button
                  onClick={() => setSelectedVoucherForPrint(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="mt-6 space-y-6 text-sm text-slate-700">
              {/* Header Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/70">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Supplier</span>
                  <span className="text-base font-bold text-slate-900 block mt-0.5">
                    {selectedVoucherForPrint.partyName}
                  </span>
                  <span className="text-xs text-slate-500">ID: {selectedVoucherForPrint.partyId}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Voucher Number
                  </span>
                  <span className="text-base font-mono font-bold text-blue-600 block mt-0.5">
                    {selectedVoucherForPrint.documentNumber}
                  </span>
                  <span className="text-xs text-slate-500 block">
                    Date: {formatDate(selectedVoucherForPrint.transactionDate)}
                  </span>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-xs text-slate-500 block">Payment Mode</span>
                  <span className="font-semibold text-slate-900">{selectedVoucherForPrint.paymentMode}</span>
                  {selectedVoucherForPrint.referenceNumber && (
                    <span className="text-xs text-slate-500 block font-mono">
                      Ref: {selectedVoucherForPrint.referenceNumber}
                    </span>
                  )}
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-xs text-slate-500 block">Paid Amount</span>
                  <span className="font-bold text-slate-900">
                    {formatPaise(
                      selectedVoucherForPrint.paymentAmountPaise || selectedVoucherForPrint.totalAmount || 0
                    )}
                  </span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-xs text-slate-500 block">Settlement Discount</span>
                  <span className="font-semibold text-blue-600">
                    {formatPaise(
                      selectedVoucherForPrint.discountPaise || selectedVoucherForPrint.discountAmount || 0
                    )}
                  </span>
                </div>
              </div>

              {/* Allocations Table */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Invoice Allocations & Settlements
                </h4>
                {(selectedVoucherForPrint.allocations || []).length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 rounded-lg text-slate-500 text-xs">
                    No specific bills linked. Full payment recorded as unallocated supplier advance.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                        <tr>
                          <th className="py-2 px-3 text-left">Bill #</th>
                          <th className="py-2 px-3 text-right">Payment</th>
                          <th className="py-2 px-3 text-right">Discount</th>
                          <th className="py-2 px-3 text-right">Total Settled</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedVoucherForPrint.allocations.map((a, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-mono font-medium text-slate-800">{a.invoiceNumber}</td>
                            <td className="py-2 px-3 text-right">{formatPaise(a.paymentAllocatedPaise || a.allocatedAmount || 0)}</td>
                            <td className="py-2 px-3 text-right text-blue-600">
                              {formatPaise(a.discountAllocatedPaise || 0)}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-slate-900">
                              {formatPaise(a.settlementAllocatedPaise || a.paymentAllocatedPaise || a.allocatedAmount || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Unallocated Advance */}
              {(selectedVoucherForPrint.unallocatedPaymentAmountPaise || selectedVoucherForPrint.unallocatedAmount || 0) > 0 && (
                <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-lg flex items-center justify-between text-xs text-amber-900">
                  <span className="font-medium">Unallocated Supplier Advance Balance:</span>
                  <span className="font-bold text-sm">
                    {formatPaise(
                      selectedVoucherForPrint.unallocatedPaymentAmountPaise || selectedVoucherForPrint.unallocatedAmount || 0
                    )}
                  </span>
                </div>
              )}

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
                <div className="border-t border-slate-200 pt-2">Authorized Signatory</div>
                <div className="border-t border-slate-200 pt-2">Supplier Receiver Signature</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Modal */}
      {selectedVoucherForReverse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reverse Disbursement</h3>
                <p className="text-xs text-slate-500">Document: {selectedVoucherForReverse.documentNumber}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Reversing this disbursement will reinstate the balances on all settled purchase bills and adjust the supplier's ledger.
            </p>

            {reverseError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {reverseError}
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Reason for Reversal *
              </label>
              <textarea
                rows={3}
                placeholder="Enter detailed reason for reversing this voucher..."
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setSelectedVoucherForReverse(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reverseReason.trim() || reverseLoading}
                onClick={handleReverse}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {reverseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
