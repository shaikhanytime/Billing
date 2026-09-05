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
import { formatPaise, toPaise, toRupees } from '@/lib/utils'

export function CreatePaymentInPage() {
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

  // Fetch customers on search
  useEffect(() => {
    const searchParties = async () => {
      try {
        const list = await partiesApi.getParties({
          type: 'CUSTOMER',
          search: partySearch || undefined,
        })
        setParties(Array.isArray(list) ? list : [])
      } catch (err) {
        console.error('Failed to search customers', err)
      }
    }
    searchParties()
  }, [partySearch])

  // Fetch open invoices when customer selected
  useEffect(() => {
    if (!partyId) {
      setEligibleInvoices([])
      setAllocations({})
      return
    }

    const fetchInvoices = async () => {
      try {
        setLoadingInvoices(true)
        const list = await paymentsApi.getEligibleInvoices(partyId, 'CUSTOMER')
        setEligibleInvoices(Array.isArray(list) ? list : [])
        setAllocations({})
      } catch (err) {
        console.error('Failed to fetch eligible invoices', err)
      } finally {
        setLoadingInvoices(false)
      }
    }

    fetchInvoices()
  }, [partyId])

  const handleSelectCustomer = (customer: Party) => {
    setPartyId(customer.id)
    setPartyName(customer.name)
    setPartyBalancePaise(customer.currentBalance)
    setIsSearchingParty(false)
    setPartySearch('')
  }

  // FIFO Auto-Allocation
  const handleAutoAllocateFIFO = () => {
    const totalCashPaise = toPaise(Number(amountRupees || 0))
    const totalDiscPaise = toPaise(Number(discountRupees || 0))
    let remSettlement = totalCashPaise + totalDiscPaise
    let remDiscount = totalDiscPaise
    let remPayment = totalCashPaise

    const newAllocs: typeof allocations = {}

    for (const inv of eligibleInvoices) {
      if (remSettlement <= 0) break

      const curDue = inv.balanceDuePaise || 0
      if (curDue <= 0) continue

      const invSettlement = Math.min(curDue, remSettlement)
      const discAlloc = Math.min(invSettlement, remDiscount)
      const payAlloc = invSettlement - discAlloc

      remSettlement -= invSettlement
      remDiscount -= discAlloc
      remPayment -= payAlloc

      newAllocs[inv.transactionId] = {
        paymentRupees: toRupees(payAlloc),
        discountRupees: toRupees(discAlloc),
      }
    }

    setAllocations(newAllocs)
  }

  // Summary Computations
  const inputPaymentPaise = toPaise(Number(amountRupees || 0))
  const inputDiscountPaise = toPaise(Number(discountRupees || 0))
  const inputSettlementPaise = inputPaymentPaise + inputDiscountPaise

  let totalAllocatedPaymentPaise = 0
  let totalAllocatedDiscPaise = 0

  Object.values(allocations).forEach((a) => {
    totalAllocatedPaymentPaise += toPaise(a.paymentRupees || 0)
    totalAllocatedDiscPaise += toPaise(a.discountRupees || 0)
  })

  const totalSettlementAllocatedPaise = totalAllocatedPaymentPaise + totalAllocatedDiscPaise
  const unallocatedAdvancePaise = Math.max(0, inputPaymentPaise - totalAllocatedPaymentPaise)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partyId) {
      setError('Please select a customer.')
      return
    }
    if (inputSettlementPaise <= 0) {
      setError('Please enter a payment amount or discount.')
      return
    }
    if (totalAllocatedPaymentPaise > inputPaymentPaise) {
      setError('Allocated cash exceeds total payment amount received.')
      return
    }
    if (inputDiscountPaise > 0 && totalAllocatedDiscPaise !== inputDiscountPaise) {
      setError('Settlement discount must be fully allocated to invoices.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const explicitAllocations = Object.entries(allocations)
        .filter(([_, a]) => (a.paymentRupees || 0) > 0 || (a.discountRupees || 0) > 0)
        .map(([invId, a]) => {
          const matchedInv = eligibleInvoices.find((i) => i.transactionId === invId)
          return {
            invoiceId: invId,
            invoiceNumber: matchedInv?.documentNumber,
            invoiceType: 'SALE_INVOICE' as const,
            paymentAllocatedPaise: toPaise(a.paymentRupees || 0),
            discountAllocatedPaise: toPaise(a.discountRupees || 0),
          }
        })

      await paymentsApi.recordPayment({
        type: 'PAYMENT_IN',
        partyId,
        partyName,
        partyType: 'CUSTOMER',
        paymentAmountPaise: inputPaymentPaise,
        discountPaise: inputDiscountPaise,
        paymentMode,
        referenceNumber: referenceNumber.trim() || undefined,
        transactionDate,
        allocations: explicitAllocations.length > 0 ? explicitAllocations : undefined,
        notes: notes.trim() || undefined,
      })

      navigate('/payments/received')
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/payments/received"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Record Customer Receipt</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Collect payment from customer, allocate across open invoices, and create advance balances
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Payment Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">1. Customer & Payment Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Customer Picker */}
            <div className="sm:col-span-2 relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              {partyId ? (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{partyName}</div>
                    {partyBalancePaise !== null && (
                      <div className="text-xs mt-0.5 font-medium">
                        Current Outstanding:{' '}
                        <span className={partyBalancePaise > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600'}>
                          {formatPaise(partyBalancePaise)}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPartyId('')
                      setPartyName('')
                      setPartyBalancePaise(null)
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={partySearch}
                    onChange={(e) => {
                      setPartySearch(e.target.value)
                      setIsSearchingParty(true)
                    }}
                    onFocus={() => setIsSearchingParty(true)}
                    placeholder="Search customer by name or phone..."
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  {isSearchingParty && parties.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {parties.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className="p-3 text-xs hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{c.name}</div>
                            <div className="text-[11px] text-slate-500">{c.phone}</div>
                          </div>
                          <div className="text-right font-mono font-semibold text-amber-600">
                            {formatPaise(c.currentBalance)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Receipt Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Date</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            {/* Amount Received */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount Received (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="0.00"
                className="w-full h-10 px-3 text-xs font-mono font-bold text-emerald-600 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            {/* Settlement Discount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cash Discount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discountRupees}
                onChange={(e) => setDiscountRupees(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="0.00"
                className="w-full h-10 px-3 text-xs font-mono text-blue-600 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Cheque #</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. UTR123456 / Cheque #..."
                className="w-full h-10 px-3 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Invoice Allocation Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                2. Settle Open Sales Invoices
              </h2>
              <p className="text-xs text-slate-500">
                Allocate payment and discount across pending invoices or leave unallocated as an advance
              </p>
            </div>
            {eligibleInvoices.length > 0 && (
              <button
                type="button"
                onClick={handleAutoAllocateFIFO}
                className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Zap className="h-3.5 w-3.5 text-blue-600" />
                Auto-Allocate FIFO
              </button>
            )}
          </div>

          {!partyId ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Please select a customer above to view open invoices.
            </div>
          ) : loadingInvoices ? (
            <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading open invoices...
            </div>
          ) : eligibleInvoices.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
              No outstanding unpaid invoices for this customer. Any payment received will be credited as an advance.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Invoice Total (₹)</th>
                    <th className="py-2.5 px-3 text-right">Balance Due (₹)</th>
                    <th className="py-2.5 px-3 text-right w-36">Cash Allocated (₹)</th>
                    <th className="py-2.5 px-3 text-right w-36">Discount (₹)</th>
                    <th className="py-2.5 px-3 text-right">Settlement Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eligibleInvoices.map((inv) => {
                    const alloc = allocations[inv.transactionId] || { paymentRupees: 0, discountRupees: 0 }
                    const lineSettlementPaise = toPaise(alloc.paymentRupees || 0) + toPaise(alloc.discountRupees || 0)

                    return (
                      <tr key={inv.transactionId} className="hover:bg-slate-50/75">
                        <td className="py-3 px-3 font-mono font-bold text-blue-600">{inv.documentNumber}</td>
                        <td className="py-3 px-3 text-slate-600">{inv.transactionDate}</td>
                        <td className="py-3 px-3 text-right font-mono">{formatPaise(inv.totalAmountPaise)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-600">
                          {formatPaise(inv.balanceDuePaise)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={alloc.paymentRupees || ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : 0
                              setAllocations({
                                ...allocations,
                                [inv.transactionId]: {
                                  ...alloc,
                                  paymentRupees: val,
                                },
                              })
                            }}
                            placeholder="0.00"
                            className="w-full text-right text-xs p-1.5 font-mono font-semibold border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={alloc.discountRupees || ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : 0
                              setAllocations({
                                ...allocations,
                                [inv.transactionId]: {
                                  ...alloc,
                                  discountRupees: val,
                                },
                              })
                            }}
                            placeholder="0.00"
                            className="w-full text-right text-xs p-1.5 font-mono text-blue-600 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatPaise(lineSettlementPaise)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Summary Bar */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total Received</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{formatPaise(inputPaymentPaise)}</div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total Settlement</span>
            <div className="text-xl font-bold font-mono text-white mt-1">{formatPaise(inputSettlementPaise)}</div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Invoices Settled</span>
            <div className="text-xl font-bold font-mono text-blue-400 mt-1">
              {formatPaise(totalSettlementAllocatedPaise)}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Unallocated Advance</span>
            <div className="text-xl font-bold font-mono text-purple-400 mt-1">
              {formatPaise(unallocatedAdvancePaise)}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/payments/received"
            className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirm & Post Payment Receipt
          </button>
        </div>
      </form>
    </div>
  )
}
