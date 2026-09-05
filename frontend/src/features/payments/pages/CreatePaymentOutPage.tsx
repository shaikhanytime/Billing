import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building2,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  Zap,
} from 'lucide-react'
import { paymentsApi, EligibleInvoice } from '../services/payments.api'
import { partiesApi, Party } from '@/features/parties/services/parties.api'
import { formatPaise, formatDate, toPaise, toRupees } from '@/lib/utils'

export function CreatePaymentOutPage() {
  const navigate = useNavigate()

  // Form State
  const [partyId, setPartyId] = useState('')
  const [partyName, setPartyName] = useState('')
  const [partyBalancePaise, setPartyBalancePaise] = useState<number | null>(null)
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE'>('CASH')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [amountRupees, setAmountRupees] = useState<number | ''>('')
  const [discountRupees, setDiscountRupees] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  // Party selector
  const [parties, setParties] = useState<Party[]>([])
  const [partySearch, setPartySearch] = useState('')
  const [isSearchingParty, setIsSearchingParty] = useState(false)

  // Invoices & Allocations
  const [eligibleInvoices, setEligibleInvoices] = useState<EligibleInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [allocations, setAllocations] = useState<{
    [invoiceId: string]: {
      paymentRupees: number
      discountRupees: number
    }
  }>({})

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch suppliers on search
  useEffect(() => {
    const searchParties = async () => {
      try {
        const list = await partiesApi.getParties({
          type: 'SUPPLIER',
          search: partySearch || undefined,
        })
        setParties(Array.isArray(list) ? list : [])
      } catch (err) {
        console.error('Failed to search suppliers', err)
      }
    }
    searchParties()
  }, [partySearch])

  // Fetch open purchase bills when supplier selected
  useEffect(() => {
    if (!partyId) {
      setEligibleInvoices([])
      setAllocations({})
      return
    }

    const fetchInvoices = async () => {
      try {
        setLoadingInvoices(true)
        const list = await paymentsApi.getEligibleInvoices(partyId, 'SUPPLIER')
        setEligibleInvoices(Array.isArray(list) ? list : [])
        setAllocations({})
      } catch (err) {
        console.error('Failed to fetch eligible purchase bills', err)
      } finally {
        setLoadingInvoices(false)
      }
    }

    fetchInvoices()
  }, [partyId])

  const handleSelectSupplier = (supplier: Party) => {
    setPartyId(supplier.id)
    setPartyName(supplier.name)
    setPartyBalancePaise(supplier.currentBalance)
    setIsSearchingParty(false)
    setPartySearch('')
  }

  // FIFO Auto-allocation
  const handleAutoAllocate = () => {
    const paymentPaise = toPaise(Number(amountRupees) || 0)
    const discountPaise = toPaise(Number(discountRupees) || 0)

    let remDiscount = discountPaise
    let remPayment = paymentPaise
    const newAlloc: { [id: string]: { paymentRupees: number; discountRupees: number } } = {}

    // Sort bills oldest first (FIFO)
    const sorted = [...eligibleInvoices].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    )

    for (const inv of sorted) {
      if (remDiscount <= 0 && remPayment <= 0) break

      let curDue = inv.balanceDuePaise
      if (curDue <= 0) continue

      // 1. Discount allocation
      const discPortion = Math.min(remDiscount, curDue)
      remDiscount -= discPortion
      curDue -= discPortion

      // 2. Physical payment allocation
      const payPortion = Math.min(remPayment, curDue)
      remPayment -= payPortion
      curDue -= payPortion

      if (discPortion > 0 || payPortion > 0) {
        newAlloc[inv.transactionId] = {
          paymentRupees: toRupees(payPortion),
          discountRupees: toRupees(discPortion),
        }
      }
    }

    setAllocations(newAlloc)
  }

  // Manual allocation input change
  const handleAllocationChange = (
    invoiceId: string,
    field: 'paymentRupees' | 'discountRupees',
    value: string
  ) => {
    const num = Math.max(0, parseFloat(value) || 0)
    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: {
        paymentRupees: prev[invoiceId]?.paymentRupees || 0,
        discountRupees: prev[invoiceId]?.discountRupees || 0,
        [field]: num,
      },
    }))
  }

  // Calculations
  const paymentAmountPaise = toPaise(Number(amountRupees) || 0)
  const discountTotalPaise = toPaise(Number(discountRupees) || 0)
  const settlementAmountPaise = paymentAmountPaise + discountTotalPaise

  const allocatedPaymentPaise = Object.values(allocations).reduce(
    (sum, a) => sum + toPaise(a.paymentRupees || 0),
    0
  )
  const allocatedDiscountPaise = Object.values(allocations).reduce(
    (sum, a) => sum + toPaise(a.discountRupees || 0),
    0
  )
  const totalAllocatedSettlementPaise = allocatedPaymentPaise + allocatedDiscountPaise

  const unallocatedPaymentPaise = Math.max(0, paymentAmountPaise - allocatedPaymentPaise)

  // Validation
  const isValidAllocations =
    allocatedPaymentPaise <= paymentAmountPaise && allocatedDiscountPaise <= discountTotalPaise

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!partyId) {
      setError('Please select a supplier.')
      return
    }

    if (paymentAmountPaise <= 0 && discountTotalPaise <= 0) {
      setError('Please enter a valid disbursement amount or discount.')
      return
    }

    if (!isValidAllocations) {
      setError('Allocations exceed the specified payment or discount amount.')
      return
    }

    // Build allocation payload
    const allocationPayload = Object.entries(allocations)
      .filter(([_, a]) => (a.paymentRupees || 0) > 0 || (a.discountRupees || 0) > 0)
      .map(([invoiceId, a]) => {
        const inv = eligibleInvoices.find((i) => i.transactionId === invoiceId)
        return {
          invoiceId,
          invoiceNumber: inv?.documentNumber || '',
          invoiceType: 'PURCHASE_INVOICE' as const,
          paymentAllocatedPaise: toPaise(a.paymentRupees || 0),
          discountAllocatedPaise: toPaise(a.discountRupees || 0),
        }
      })

    try {
      setSubmitting(true)
      await paymentsApi.recordPayment({
        partyId,
        partyName,
        partyType: 'SUPPLIER',
        type: 'PAYMENT_OUT',
        paymentMode,
        referenceNumber: referenceNumber || undefined,
        transactionDate,
        paymentAmountPaise,
        discountPaise: discountTotalPaise,
        notes: notes || undefined,
        allocations: allocationPayload.length > 0 ? allocationPayload : undefined,
      })

      navigate('/payments/made')
    } catch (err: any) {
      console.error('Failed to create payment', err)
      setError(err.response?.data?.error || err.message || 'Failed to record supplier disbursement.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/payments/made"
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Record Payment Made</h1>
            <p className="text-sm text-slate-500">Disburse payment to a supplier against bills or as advance</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/payments/made"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !partyId || (paymentAmountPaise <= 0 && discountTotalPaise <= 0)}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Post Payment Out
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Supplier Selection & Header Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Supplier & Disbursement Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Supplier Selector */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Supplier *
            </label>
            {partyId ? (
              <div className="flex items-center justify-between p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl">
                <div>
                  <div className="font-semibold text-slate-900">{partyName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Current Balance:{' '}
                    <span className="font-semibold text-slate-700">
                      {partyBalancePaise !== null ? formatPaise(partyBalancePaise) : '—'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPartyId('')
                    setPartyName('')
                    setPartyBalancePaise(null)
                  }}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search supplier by name or phone..."
                    value={partySearch}
                    onChange={(e) => {
                      setPartySearch(e.target.value)
                      setIsSearchingParty(true)
                    }}
                    onFocus={() => setIsSearchingParty(true)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {isSearchingParty && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {parties.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 text-center">No suppliers found</div>
                    ) : (
                      parties.map((supplier) => (
                        <button
                          key={supplier.id}
                          type="button"
                          onClick={() => handleSelectSupplier(supplier)}
                          className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <div className="font-medium text-slate-900 text-sm">{supplier.name}</div>
                            <div className="text-xs text-slate-500">{supplier.phone || supplier.gstin || 'No GSTIN'}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-slate-700">
                              {formatPaise(supplier.currentBalance)}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Payment Date *
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Payment Mode & Amounts */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Payment Mode *
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Reference / Cheque #
            </label>
            <input
              type="text"
              placeholder="e.g. UTR / Chq # 49201"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Payment Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Discount Received (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={discountRupees}
              onChange={(e) => setDiscountRupees(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Internal Notes / Remarks
          </label>
          <input
            type="text"
            placeholder="Add internal remarks about this disbursement..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Bill Allocations Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Purchase Bill Allocation</h2>
            <p className="text-xs text-slate-500">
              Apply this disbursement and discount against outstanding purchase bills or leave unallocated as an advance
            </p>
          </div>

          {partyId && eligibleInvoices.length > 0 && (
            <button
              type="button"
              onClick={handleAutoAllocate}
              disabled={paymentAmountPaise <= 0 && discountTotalPaise <= 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              Auto-Allocate (FIFO)
            </button>
          )}
        </div>

        {!partyId ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-500 text-sm border border-dashed border-slate-200">
            Please select a supplier to load their unpaid purchase bills.
          </div>
        ) : loadingInvoices ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : eligibleInvoices.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800">No Outstanding Purchase Bills</div>
            <p className="text-xs text-slate-500 mt-1">
              This supplier has no pending unpaid bills. The payment will be safely stored as an unallocated advance.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Bill Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-right w-36">Pay Amount (₹)</th>
                  <th className="py-3 px-4 text-right w-36">Discount (₹)</th>
                  <th className="py-3 px-4 text-right">Net Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eligibleInvoices.map((inv) => {
                  const payRupees = allocations[inv.transactionId]?.paymentRupees || 0
                  const discRupees = allocations[inv.transactionId]?.discountRupees || 0
                  const totalSettledPaise = toPaise(payRupees) + toPaise(discRupees)
                  const remDuePaise = Math.max(0, inv.balanceDuePaise - totalSettledPaise)

                  return (
                    <tr key={inv.transactionId} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{inv.documentNumber}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(inv.transactionDate)}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatPaise(inv.totalAmountPaise)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600">
                        {formatPaise(inv.balanceDuePaise)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={toRupees(inv.balanceDuePaise)}
                          value={payRupees === 0 ? '' : payRupees}
                          placeholder="0.00"
                          onChange={(e) => handleAllocationChange(inv.transactionId, 'paymentRupees', e.target.value)}
                          className="w-full text-right px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={toRupees(inv.balanceDuePaise)}
                          value={discRupees === 0 ? '' : discRupees}
                          placeholder="0.00"
                          onChange={(e) => handleAllocationChange(inv.transactionId, 'discountRupees', e.target.value)}
                          className="w-full text-right px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                        {formatPaise(remDuePaise)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reconciliation & Summary Box */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Disbursement Reconciliation & Invariants
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div>
            <span className="text-xs text-slate-400 block">Total Settlement</span>
            <span className="text-lg font-bold text-white">{formatPaise(settlementAmountPaise)}</span>
            <span className="text-[11px] text-slate-400 block">
              ({formatPaise(paymentAmountPaise)} + {formatPaise(discountTotalPaise)})
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">Allocated to Bills</span>
            <span className="text-lg font-bold text-emerald-400">
              {formatPaise(totalAllocatedSettlementPaise)}
            </span>
            <span className="text-[11px] text-slate-400 block">
              Pay: {formatPaise(allocatedPaymentPaise)} | Disc: {formatPaise(allocatedDiscountPaise)}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">Unallocated Supplier Advance</span>
            <span className="text-lg font-bold text-amber-400">
              {formatPaise(unallocatedPaymentPaise)}
            </span>
            <span className="text-[11px] text-slate-400 block">Physical advance balance</span>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">Allocation Status</span>
            {isValidAllocations ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 mt-1">
                <CheckCircle2 className="h-4 w-4" /> Balanced & Safe
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 mt-1">
                <AlertCircle className="h-4 w-4" /> Overallocated
              </span>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
