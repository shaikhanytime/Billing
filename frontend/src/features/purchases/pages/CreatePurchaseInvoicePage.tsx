import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, AlertCircle, CheckCircle2, Building2 } from 'lucide-react'
import { purchasesApi, CreatePurchaseInvoicePayload } from '../services/purchases.api'
import { partiesApi, Party } from '../../parties/services/parties.api'
import { inventoryApi, Product } from '../../inventory/services/inventory.api'
import { formatPaise } from '@/lib/utils'

interface PurchaseLineRow {
  productId: string
  productName: string
  sku?: string
  hsnCode: string
  unit: string
  quantity: number
  unitCostPaise: number
  discountPercent: number
  discountPaise: number
  taxRate: 0 | 5 | 12 | 18 | 28
  isTaxInclusive: boolean
}

export function CreatePurchaseInvoicePage() {
  const navigate = useNavigate()

  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Party | null>(null)

  const [vendorBillNumber, setVendorBillNumber] = useState('')
  const [vendorBillDate, setVendorBillDate] = useState(new Date().toISOString().slice(0, 10))
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [placeOfSupply, setPlaceOfSupply] = useState('27')
  const [warehouseId, setWarehouseId] = useState('MAIN')

  const [lineItems, setLineItems] = useState<PurchaseLineRow[]>([])
  const [discountPaise, setDiscountPaise] = useState(0)
  const [additionalChargesPaise, setAdditionalChargesPaise] = useState(0)

  // Payment settlement
  const [isPaid, setIsPaid] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('BANK_TRANSFER')
  const [paidAmountRupees, setPaidAmountRupees] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null)

  useEffect(() => {
    partiesApi.getParties({ type: 'SUPPLIER' }).then(setSuppliers)
    inventoryApi.getProducts().then(setProducts)
  }, [])

  const addItemToBill = (product: Product) => {
    setLineItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        hsnCode: product.hsnCode || 'N/A',
        unit: product.baseUnitSymbol || 'PCS',
        quantity: 1,
        unitCostPaise: product.purchaseCost || product.salePrice,
        discountPercent: 0,
        discountPaise: 0,
        taxRate: product.taxRate,
        isTaxInclusive: false,
      },
    ])
  }

  const updateLineItem = (index: number, updates: Partial<PurchaseLineRow>) => {
    setLineItems((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index]!, ...updates }
      return copy
    })
  }

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Calculations
  let subtotalTaxablePaise = 0
  let totalCgstPaise = 0
  let totalSgstPaise = 0
  let totalIgstPaise = 0
  const isIntraState = placeOfSupply === '27'

  const calculatedLines = lineItems.map((item) => {
    const grossLinePaise = Math.round(item.quantity * item.unitCostPaise)
    const discPaise = Math.round((grossLinePaise * (item.discountPercent || 0)) / 100) + (item.discountPaise || 0)
    const netGrossPaise = Math.max(0, grossLinePaise - discPaise)

    let taxablePaise = netGrossPaise
    let taxPaise = 0

    if (item.isTaxInclusive && item.taxRate > 0) {
      taxablePaise = Math.round((netGrossPaise * 10000) / (10000 + item.taxRate * 100))
      taxPaise = netGrossPaise - taxablePaise
    } else if (!item.isTaxInclusive && item.taxRate > 0) {
      taxablePaise = netGrossPaise
      taxPaise = Math.round((netGrossPaise * item.taxRate) / 100)
    }

    let cgst = 0
    let sgst = 0
    let igst = 0

    if (isIntraState) {
      const half = Math.round(taxPaise / 2)
      cgst = half
      sgst = half
    } else {
      igst = taxPaise
    }

    const totalLinePaise = taxablePaise + cgst + sgst + igst

    subtotalTaxablePaise += taxablePaise
    totalCgstPaise += cgst
    totalSgstPaise += sgst
    totalIgstPaise += igst

    return {
      ...item,
      taxablePaise,
      cgst,
      sgst,
      igst,
      totalTaxPaise: cgst + sgst + igst,
      totalLinePaise,
    }
  })

  const rawTotalPaise =
    subtotalTaxablePaise +
    totalCgstPaise +
    totalSgstPaise +
    totalIgstPaise -
    discountPaise +
    additionalChargesPaise

  const roundedTotalPaise = Math.round(rawTotalPaise / 100) * 100
  const roundOffPaise = roundedTotalPaise - rawTotalPaise

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      setError('Please select a supplier.')
      return
    }
    if (!vendorBillNumber.trim()) {
      setError('Original vendor bill number is required.')
      return
    }
    if (lineItems.length === 0) {
      setError('Please add at least one line item.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const paidPaise = isPaid
        ? paidAmountRupees
          ? Math.round(Number(paidAmountRupees) * 100)
          : roundedTotalPaise
        : 0

      const payload: CreatePurchaseInvoicePayload = {
        vendorBillNumber,
        vendorBillDate,
        invoiceDate,
        partyId: selectedSupplier.id,
        partyName: selectedSupplier.name,
        partyGstin: selectedSupplier.gstin,
        partyStateCode: selectedSupplier.billingAddress?.stateCode || placeOfSupply,
        placeOfSupply,
        warehouseId,
        items: lineItems.map((item) => ({
          productId: item.productId,
          quantity: Math.round(item.quantity * 1000),
          unitCostPaise: item.unitCostPaise,
          isTaxInclusive: item.isTaxInclusive,
          discountPercent: item.discountPercent,
          discountPaise: item.discountPaise,
          taxRate: item.taxRate,
        })),
        discountPaise,
        additionalChargesPaise,
        payment:
          paidPaise > 0
            ? {
                paymentMode,
                amountPaise: paidPaise,
              }
            : undefined,
      }

      const created = await purchasesApi.createInvoice(payload)
      setCreatedInvoice(created)
    } catch (err: any) {
      setError(err.message || 'Failed to record purchase invoice.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/purchases/invoices')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Record Purchase Bill</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Inward inventory bill entry with automatic Weighted Average Cost (WAC) valuation update
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bill Metadata Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier / Vendor <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={selectedSupplier?.id || ''}
              onChange={(e) => {
                const s = suppliers.find((x) => x.id === e.target.value) || null
                setSelectedSupplier(s)
                if (s?.billingAddress?.stateCode) {
                  setPlaceOfSupply(s.billingAddress.stateCode)
                }
              }}
              className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
            >
              <option value="">Select Supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.currentBalance !== 0 ? `(Payable: ${formatPaise(Math.abs(s.currentBalance))})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vendor Bill Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={vendorBillNumber}
              onChange={(e) => setVendorBillNumber(e.target.value)}
              placeholder="e.g. INV/2026/892"
              className="w-full h-10 px-3 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Bill Date</label>
            <input
              type="date"
              value={vendorBillDate}
              onChange={(e) => setVendorBillDate(e.target.value)}
              className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Add Items Dropdown */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <select
          value=""
          onChange={(e) => {
            const p = products.find((x) => x.id === e.target.value)
            if (p) addItemToBill(p)
          }}
          className="flex-1 h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
        >
          <option value="">Select Product to Add to Inward Purchase...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — Current Purchase Cost: {formatPaise(p.purchaseCost)}
            </option>
          ))}
        </select>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Inward Items</h2>
          <span className="text-xs text-slate-500 font-mono">{lineItems.length} items</span>
        </div>

        {lineItems.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No items added yet. Select products from the dropdown above to add inward stock.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Product Name</th>
                  <th className="py-2.5 px-3 text-center">Inward Qty</th>
                  <th className="py-2.5 px-4 text-right">Purchase Rate (₹)</th>
                  <th className="py-2.5 px-3 text-center">GST %</th>
                  <th className="py-2.5 px-4 text-right">Taxable (₹)</th>
                  <th className="py-2.5 px-4 text-right">Total Line (₹)</th>
                  <th className="py-2.5 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculatedLines.map((item, idx) => (
                  <tr key={item.productId} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.productName}</td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        min="0.001"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, { quantity: Number(e.target.value) || 1 })}
                        className="w-16 h-8 text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={(item.unitCostPaise / 100).toFixed(2)}
                        onChange={(e) =>
                          updateLineItem(idx, { unitCostPaise: Math.round(Number(e.target.value) * 100) })
                        }
                        className="w-20 h-8 text-right px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-blue-600">{item.taxRate}%</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">{formatPaise(item.taxablePaise)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                      {formatPaise(item.totalLinePaise)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => removeLineItem(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bill Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Settlement Status</h3>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Payment Made Immediately (Payment Out)</span>
          </label>

          {isPaid && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-4 gap-2">
                {(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMode(m)}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-lg border text-center ${
                      paymentMode === m ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input
                type="number"
                step="0.01"
                value={paidAmountRupees}
                onChange={(e) => setPaidAmountRupees(e.target.value)}
                placeholder={(roundedTotalPaise / 100).toFixed(2)}
                className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg font-mono font-bold"
              />
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Taxable Subtotal:</span>
            <span className="font-mono font-medium">{formatPaise(subtotalTaxablePaise)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Total Input Tax:</span>
            <span className="font-mono font-medium">{formatPaise(totalCgstPaise + totalSgstPaise + totalIgstPaise)}</span>
          </div>
          <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
            <span className="text-sm font-bold text-slate-900">Total Purchase Bill:</span>
            <span className="text-2xl font-extrabold text-blue-600 font-mono">
              {formatPaise(roundedTotalPaise)}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || lineItems.length === 0}
            className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {loading ? 'Posting Purchase Bill...' : 'Record Purchase Bill & Update Stock'}
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {createdInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-center space-y-4">
            <div className="h-14 w-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Purchase Bill Recorded!</h2>
            <p className="text-xs text-slate-500">
              Internal Ref: {createdInvoice.documentNumber} • Vendor Bill #{createdInvoice.vendorBillNumber}
            </p>
            <p className="text-xs text-slate-400">Inventory on-hand and WAC updated atomically.</p>
            <button
              onClick={() => navigate('/purchases/invoices')}
              className="w-full py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              Back to Purchase Bills
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
