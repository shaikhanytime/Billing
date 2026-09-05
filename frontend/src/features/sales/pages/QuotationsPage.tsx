import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  Send,
  Check,
  XCircle,
  ArrowRight,
  FileText,
  AlertTriangle,
  Loader2,
  Calendar,
  User,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import { quotationsApi, Quotation, QuotationStatus } from '../services/quotations.api'
import { formatPaise, formatDate } from '@/lib/utils'

export function QuotationsPage() {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Modals state
  const [selectedQuoteForPrint, setSelectedQuoteForPrint] = useState<Quotation | null>(null)
  const [selectedQuoteForConvert, setSelectedQuoteForConvert] = useState<Quotation | null>(null)
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertSuccess, setConvertSuccess] = useState<{ invoiceId: string; invoiceNumber: string } | null>(null)

  const fetchQuotations = async () => {
    try {
      setLoading(true)
      const data = await quotationsApi.getQuotations({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as QuotationStatus),
      })
      setQuotations(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch quotations', err)
      setQuotations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotations()
  }, [statusFilter])

  const handleStatusChange = async (id: string, newStatus: QuotationStatus) => {
    try {
      await quotationsApi.updateStatus(id, newStatus)
      await fetchQuotations()
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to update status')
    }
  }

  const handleConvert = async () => {
    if (!selectedQuoteForConvert) return
    setConvertLoading(true)
    setConvertError(null)

    try {
      const result = await quotationsApi.convertToInvoice(selectedQuoteForConvert.id)
      setConvertSuccess({
        invoiceId: result.invoice.transactionId,
        invoiceNumber: result.invoice.documentNumber,
      })
      await fetchQuotations()
    } catch (err: any) {
      setConvertError(err.response?.data?.error || err.message || 'Conversion failed.')
    } finally {
      setConvertLoading(false)
    }
  }

  const safeQuotations = quotations || []
  const filteredQuotations = safeQuotations.filter((q) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      q.documentNumber.toLowerCase().includes(s) ||
      q.partyName.toLowerCase().includes(s) ||
      (q.partyGstin && q.partyGstin.toLowerCase().includes(s))
    )
  })

  const totalQuotedPaise = safeQuotations.reduce((sum, q) => sum + (q.totalAmountPaise || 0), 0)
  const acceptedCount = safeQuotations.filter((q) => q.quotationStatus === 'ACCEPTED').length
  const convertedCount = safeQuotations.filter((q) => q.quotationStatus === 'CONVERTED').length

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="h-3 w-3" /> Draft
          </span>
        )
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Send className="h-3 w-3" /> Sent
          </span>
        )
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="h-3 w-3" /> Accepted
          </span>
        )
      case 'CONVERTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <CheckCircle2 className="h-3 w-3" /> Invoiced
          </span>
        )
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" /> Expired
          </span>
        )
      case 'DECLINED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="h-3 w-3" /> Declined
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quotations & Estimates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create commercial quotes, manage approval workflows, and atomically convert accepted estimates to Tax Invoices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/sales/quotations/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow-md transition-all active:scale-98"
          >
            <Plus className="h-4 w-4" />
            New Quotation
          </Link>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quotes</span>
          <div className="text-2xl font-bold text-slate-900 mt-1.5">{quotations.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quoted Pipeline</span>
          <div className="text-2xl font-bold text-blue-600 mt-1.5">{formatPaise(totalQuotedPaise)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ready for Invoicing</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1.5">{acceptedCount} Accepted</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Converted to Invoices</span>
          <div className="text-2xl font-bold text-purple-600 mt-1.5">{convertedCount} Invoiced</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by quote # or customer name..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'DECLINED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Loading quotations...
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No quotations found. Click &quot;New Quotation&quot; to generate an estimate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Quotation #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4 text-right">Quoted Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono font-bold text-blue-600">{q.documentNumber}</span>
                      {q.convertedToInvoiceId && (
                        <div className="text-[10px] text-purple-600 font-mono mt-0.5">
                          Invoiced
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {formatDate(q.quotationDate)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{q.partyName}</div>
                      {q.partyGstin && <div className="text-[10px] text-slate-400 font-mono">{q.partyGstin}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {formatDate(q.validUntil)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                      {formatPaise(q.totalAmountPaise)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(q.quotationStatus)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Print preview */}
                        <button
                          onClick={() => setSelectedQuoteForPrint(q)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Print Estimate"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {/* Lifecycle Transition Buttons */}
                        {q.quotationStatus === 'DRAFT' && (
                          <button
                            onClick={() => handleStatusChange(q.id, 'SENT')}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Send className="h-3 w-3" /> Send
                          </button>
                        )}

                        {q.quotationStatus === 'SENT' && (
                          <button
                            onClick={() => handleStatusChange(q.id, 'ACCEPTED')}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Check className="h-3 w-3" /> Accept
                          </button>
                        )}

                        {q.quotationStatus === 'ACCEPTED' && (
                          <button
                            onClick={() => {
                              setSelectedQuoteForConvert(q)
                              setConvertError(null)
                              setConvertSuccess(null)
                            }}
                            className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs hover:shadow-sm transition-all flex items-center gap-1"
                          >
                            <ArrowRight className="h-3.5 w-3.5" /> Convert to Invoice
                          </button>
                        )}

                        {q.quotationStatus === 'CONVERTED' && (
                          <Link
                            to="/sales/invoices"
                            className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> View Invoices
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Convert to Tax Invoice Confirmation Modal */}
      {selectedQuoteForConvert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Convert Quotation to Tax Invoice</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedQuoteForConvert(null)
                  setConvertError(null)
                  setConvertSuccess(null)
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {convertSuccess ? (
              <div className="py-4 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-lg">Quotation Converted Successfully!</h4>
                <p className="text-xs text-slate-600">
                  Tax Invoice <span className="font-bold font-mono text-blue-600">{convertSuccess.invoiceNumber}</span> has been generated and posted. Stock and ledger balances have been updated atomically.
                </p>
                <div className="pt-3 flex items-center justify-center gap-3">
                  <Link
                    to="/sales/invoices"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
                  >
                    Go to Sales Invoices
                  </Link>
                  <button
                    onClick={() => {
                      setSelectedQuoteForConvert(null)
                      setConvertSuccess(null)
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quotation #:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedQuoteForConvert.documentNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-semibold text-slate-900">{selectedQuoteForConvert.partyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quoted Amount:</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">
                      {formatPaise(selectedQuoteForConvert.totalAmountPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Line Items:</span>
                    <span className="text-slate-700">{selectedQuoteForConvert.items.length} items</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <strong>Financial Mutation Confirmation:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                      <li>Authoritative sequence INV-XXXXX will be allocated</li>
                      <li>Commercial prices from quotation snapshot are locked</li>
                      <li>Inventory will be decremented by canonical base quantities</li>
                      <li>Customer receivable will be posted to party ledger</li>
                    </ul>
                  </div>
                </div>

                {convertError && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700">
                    {convertError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedQuoteForConvert(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={convertLoading}
                    onClick={handleConvert}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {convertLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Confirm & Generate Tax Invoice
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Printable Estimate Preview Modal */}
      {selectedQuoteForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-8 space-y-6 my-8 print:m-0 print:p-0">
            {/* Print Header Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Commercial Estimate Document Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Estimate
                </button>
                <button
                  onClick={() => setSelectedQuoteForPrint(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="space-y-6 border border-slate-200 p-8 rounded-xl bg-white shadow-xs">
              {/* Document Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                    QUOTATION / ESTIMATE
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold mt-1">
                    COMMERCIAL PROPOSAL (NON-POSTING DOCUMENT)
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    This document is an estimate and does not represent a Tax Invoice or accounting receipt.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-blue-600">
                    {selectedQuoteForPrint.documentNumber}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Date: <span className="font-semibold">{formatDate(selectedQuoteForPrint.quotationDate)}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Valid Until: <span className="font-semibold">{formatDate(selectedQuoteForPrint.validUntil)}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Place of Supply: <span className="font-semibold font-mono">{selectedQuoteForPrint.placeOfSupply}</span>
                  </div>
                </div>
              </div>

              {/* Customer Snapshot */}
              <div className="grid grid-cols-2 gap-6 text-xs border-b border-slate-200 pb-6">
                <div>
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Quoted To:</span>
                  <div className="font-bold text-slate-900 text-sm mt-1">{selectedQuoteForPrint.partyName}</div>
                  {selectedQuoteForPrint.partyGstin && (
                    <div className="text-slate-600 font-mono mt-0.5">GSTIN: {selectedQuoteForPrint.partyGstin}</div>
                  )}
                  {selectedQuoteForPrint.partyPhone && (
                    <div className="text-slate-600 mt-0.5">Phone: {selectedQuoteForPrint.partyPhone}</div>
                  )}
                  {selectedQuoteForPrint.billingAddress && (
                    <div className="text-slate-500 mt-1">
                      {selectedQuoteForPrint.billingAddress.street}, {selectedQuoteForPrint.billingAddress.city},{' '}
                      {selectedQuoteForPrint.billingAddress.state} - {selectedQuoteForPrint.billingAddress.pincode}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Quotation Status:</span>
                  <div className="mt-1">{getStatusBadge(selectedQuoteForPrint.quotationStatus)}</div>
                </div>
              </div>

              {/* Line Items Table */}
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-2 text-center">HSN</th>
                    <th className="py-2 px-2 text-center">Quoted Qty</th>
                    <th className="py-2 px-3 text-right">Unit Rate (₹)</th>
                    <th className="py-2 px-2 text-center">GST %</th>
                    <th className="py-2 px-3 text-right">Taxable (₹)</th>
                    <th className="py-2 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedQuoteForPrint.items.map((it, idx) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{it.productName}</div>
                        {it.enteredUnit !== 'PCS' && (
                          <div className="text-[10px] text-slate-500">
                            Pack: {it.conversionNumerator}/{it.conversionDenominator} base units ({it.baseQuantity / 1000} PCS)
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600">{it.hsnCode}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-900">
                        {it.enteredQuantity / 1000} {it.enteredUnit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                        {formatPaise(it.unitPricePaise)}
                      </td>
                      <td className="py-2.5 px-2 text-center font-semibold text-blue-600">{it.taxRate}%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatPaise(it.taxablePaise)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                        {formatPaise(it.totalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div className="flex justify-end pt-4 border-t border-slate-200">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono">{formatPaise(selectedQuoteForPrint.taxableAmountPaise)}</span>
                  </div>
                  {selectedQuoteForPrint.cgstAmountPaise > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>CGST:</span>
                      <span className="font-mono">{formatPaise(selectedQuoteForPrint.cgstAmountPaise)}</span>
                    </div>
                  )}
                  {selectedQuoteForPrint.sgstAmountPaise > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>SGST:</span>
                      <span className="font-mono">{formatPaise(selectedQuoteForPrint.sgstAmountPaise)}</span>
                    </div>
                  )}
                  {selectedQuoteForPrint.igstAmountPaise > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST:</span>
                      <span className="font-mono">{formatPaise(selectedQuoteForPrint.igstAmountPaise)}</span>
                    </div>
                  )}
                  {selectedQuoteForPrint.discountPaise > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatPaise(selectedQuoteForPrint.discountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500">
                    <span>Round-Off:</span>
                    <span className="font-mono">{formatPaise(selectedQuoteForPrint.roundOffPaise)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-300 font-bold text-sm text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-blue-600 font-mono text-base font-extrabold">
                      {formatPaise(selectedQuoteForPrint.totalAmountPaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions */}
              {selectedQuoteForPrint.termsAndConditions && (
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                  <span className="font-bold text-slate-700">Terms & Conditions:</span>
                  <p className="mt-1 whitespace-pre-line">{selectedQuoteForPrint.termsAndConditions}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
