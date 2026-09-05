import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Trash2,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Printer,
  CreditCard,
  Banknote,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'
import { salesApi, CreateSaleInvoicePayload } from '../services/sales.api'
import { partiesApi, Party } from '../../parties/services/parties.api'
import { inventoryApi, Product } from '../../inventory/services/inventory.api'
import { formatPaise, formatCurrency } from '@/lib/utils'

interface LineItemRow {
  productId: string
  productName: string
  sku?: string
  barcode?: string
  hsnCode: string
  unit: string
  quantity: number
  unitPricePaise: number
  discountPercent: number
  discountPaise: number
  taxRate: 0 | 5 | 12 | 18 | 28
  isTaxInclusive: boolean
  availableStock: number
}

export function CreateSaleInvoicePage() {
  const navigate = useNavigate()
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const [parties, setParties] = useState<Party[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedParty, setSelectedParty] = useState<Party | null>(null)

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [placeOfSupply, setPlaceOfSupply] = useState('27')
  const [isPosMode, setIsPosMode] = useState(false)
  const [warehouseId, setWarehouseId] = useState('MAIN')

  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [lineItems, setLineItems] = useState<LineItemRow[]>([])

  const [invoiceDiscountPaise, setInvoiceDiscountPaise] = useState(0)
  const [additionalChargesPaise, setAdditionalChargesPaise] = useState(0)

  // Instant Payment options (especially for POS)
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH')
  const [receivedAmountRupees, setReceivedAmountRupees] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null)

  useEffect(() => {
    partiesApi.getParties({ type: 'CUSTOMER' }).then(setParties)
    inventoryApi.getProducts().then(setProducts)
  }, [])

  // Auto handle Barcode scanner enter key
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeQuery.trim()) return

    const matched = products.find(
      (p) =>
        p.barcode === barcodeQuery.trim() ||
        p.sku?.toLowerCase() === barcodeQuery.trim().toLowerCase()
    )

    if (matched) {
      addItemToInvoice(matched)
      setBarcodeQuery('')
    } else {
      setError(`Product with barcode/SKU "${barcodeQuery}" not found.`)
    }
  }

  const addItemToInvoice = (product: Product) => {
    setError(null)
    setLineItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.productId === product.id)
      if (existingIdx >= 0) {
        const copy = [...prev]
        const current = copy[existingIdx]!
        copy[existingIdx] = {
          ...current,
          quantity: current.quantity + 1,
        }
        return copy
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            barcode: product.barcode,
            hsnCode: product.hsnCode || 'N/A',
            unit: product.baseUnitSymbol || 'PCS',
            quantity: 1,
            unitPricePaise: product.salePrice,
            discountPercent: 0,
            discountPaise: 0,
            taxRate: product.taxRate,
            isTaxInclusive: product.isTaxInclusive || false,
            availableStock: (product.stockQty || 0) / 1000,
          },
        ]
      }
    })
  }

  const updateLineItem = (index: number, updates: Partial<LineItemRow>) => {
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
  const isIntraState = placeOfSupply === '27' // Assuming company state 27

  const calculatedLines = lineItems.map((item) => {
    const grossLinePaise = Math.round(item.quantity * item.unitPricePaise)
    const discountPaise = Math.round((grossLinePaise * (item.discountPercent || 0)) / 100) + (item.discountPaise || 0)
    const netGrossPaise = Math.max(0, grossLinePaise - discountPaise)

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
    invoiceDiscountPaise +
    additionalChargesPaise

  const roundedTotalPaise = Math.round(rawTotalPaise / 100) * 100
  const roundOffPaise = roundedTotalPaise - rawTotalPaise

  const handleSubmitInvoice = async () => {
    if (lineItems.length === 0) {
      setError('Please add at least one line item.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const receivedPaise = receivedAmountRupees
        ? Math.round(Number(receivedAmountRupees) * 100)
        : isPosMode
        ? roundedTotalPaise
        : 0

      const payload: CreateSaleInvoicePayload = {
        documentType: isPosMode ? 'POS_SALE' : 'SALE_INVOICE',
        invoiceDate,
        partyId: selectedParty?.id,
        partyName: selectedParty?.name || 'Walk-in Cash Customer',
        partyPhone: selectedParty?.phone,
        partyGstin: selectedParty?.gstin,
        partyStateCode: selectedParty?.billingAddress?.stateCode || placeOfSupply,
        placeOfSupply,
        warehouseId,
        items: lineItems.map((item) => ({
          productId: item.productId,
          quantity: Math.round(item.quantity * 1000), // Scaled units
          unitPricePaise: item.unitPricePaise,
          isTaxInclusive: item.isTaxInclusive,
          discountPercent: item.discountPercent,
          discountPaise: item.discountPaise,
          taxRate: item.taxRate,
        })),
        discountPaise: invoiceDiscountPaise,
        additionalChargesPaise,
        payment:
          receivedPaise > 0
            ? {
                paymentMode,
                amountPaise: receivedPaise,
              }
            : undefined,
        isPosSale: isPosMode,
      }

      const created = await salesApi.createInvoice(payload)
      setCreatedInvoice(created)
    } catch (err: any) {
      setError(err.message || 'Failed to create invoice.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sales/invoices')}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isPosMode ? 'Fast POS Counter Billing' : 'Create Sales Invoice'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              GST-compliant server-authoritative invoicing with automatic stock decrement
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setIsPosMode(false)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              !isPosMode ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Standard Invoice
          </button>
          <button
            type="button"
            onClick={() => setIsPosMode(true)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              isPosMode ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ⚡ Fast POS Fast Lane
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Invoice Details Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Customer Selector */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer / Party <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedParty?.id || ''}
              onChange={(e) => {
                const p = parties.find((x) => x.id === e.target.value) || null
                setSelectedParty(p)
                if (p?.billingAddress?.stateCode) {
                  setPlaceOfSupply(p.billingAddress.stateCode)
                }
              }}
              className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
            >
              <option value="">Walk-in Cash Customer (Generic)</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.currentBalance !== 0 ? `(Bal: ${formatPaise(p.currentBalance)})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Place of Supply</label>
            <input
              type="text"
              maxLength={2}
              value={placeOfSupply}
              onChange={(e) => setPlaceOfSupply(e.target.value)}
              placeholder="27"
              className="w-full h-10 px-3 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Barcode & Product Quick Search Wedge */}
      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center">
        <form onSubmit={handleBarcodeSubmit} className="relative flex-1 w-full">
          <Barcode className="absolute left-3.5 top-2.5 h-4 w-4 text-blue-500" />
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeQuery}
            onChange={(e) => setBarcodeQuery(e.target.value)}
            placeholder="Scan barcode with scanner or type SKU and hit Enter..."
            className="w-full h-10 pl-10 pr-4 text-xs font-mono bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
          />
        </form>

        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <select
            value=""
            onChange={(e) => {
              const p = products.find((x) => x.id === e.target.value)
              if (p) addItemToInvoice(p)
            }}
            className="w-full h-10 pl-10 pr-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          >
            <option value="">Search & Select Item to Add...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatPaise(p.salePrice)} (Stock: {(p.stockQty / 1000).toFixed(0)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Invoice Line Items</h2>
          <span className="text-xs text-slate-500 font-mono">{lineItems.length} items added</span>
        </div>

        {lineItems.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No items added yet. Scan a barcode above or select products from the dropdown.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-3">HSN</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Rate (₹)</th>
                  <th className="py-2.5 px-3 text-center">Disc %</th>
                  <th className="py-2.5 px-3 text-center">GST %</th>
                  <th className="py-2.5 px-4 text-right">Taxable (₹)</th>
                  <th className="py-2.5 px-4 text-right">Total (₹)</th>
                  <th className="py-2.5 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculatedLines.map((item, idx) => (
                  <tr key={item.productId} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Avail: {item.availableStock} {item.unit}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">{item.hsnCode}</td>
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
                        value={(item.unitPricePaise / 100).toFixed(2)}
                        onChange={(e) =>
                          updateLineItem(idx, { unitPricePaise: Math.round(Number(e.target.value) * 100) })
                        }
                        className="w-20 h-8 text-right px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discountPercent}
                        onChange={(e) => updateLineItem(idx, { discountPercent: Number(e.target.value) || 0 })}
                        className="w-14 h-8 text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-blue-600">{item.taxRate}%</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatPaise(item.taxablePaise)}
                    </td>
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

      {/* Invoice Summary & Instant Checkout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Payment Details */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Settlement & Payment</h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Payment Mode</label>
            <div className="grid grid-cols-4 gap-2">
              {(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMode(m)}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                    paymentMode === m
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Received Amount (₹) {isPosMode && <span className="text-blue-600 font-normal">(Auto-Filled for POS)</span>}
            </label>
            <input
              type="number"
              step="0.01"
              value={receivedAmountRupees}
              onChange={(e) => setReceivedAmountRupees(e.target.value)}
              placeholder={(roundedTotalPaise / 100).toFixed(2)}
              className="w-full h-10 px-3 text-sm font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
            />
          </div>
        </div>

        {/* Net Tax & Total Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Taxable Subtotal:</span>
            <span className="font-mono font-medium">{formatPaise(subtotalTaxablePaise)}</span>
          </div>
          {isIntraState ? (
            <>
              <div className="flex justify-between text-xs text-slate-600">
                <span>CGST:</span>
                <span className="font-mono">{formatPaise(totalCgstPaise)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>SGST:</span>
                <span className="font-mono">{formatPaise(totalSgstPaise)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-xs text-slate-600">
              <span>IGST:</span>
              <span className="font-mono">{formatPaise(totalIgstPaise)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-slate-500">
            <span>Round-Off:</span>
            <span className="font-mono">{formatPaise(roundOffPaise)}</span>
          </div>
          <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
            <span className="text-sm font-bold text-slate-900">Grand Total:</span>
            <span className="text-2xl font-extrabold text-blue-600 font-mono">
              {formatPaise(roundedTotalPaise)}
            </span>
          </div>

          <button
            onClick={handleSubmitInvoice}
            disabled={loading || lineItems.length === 0}
            className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Posting Invoice...' : isPosMode ? '⚡ Complete Fast POS Checkout' : 'Generate Tax Invoice'}
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {createdInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 text-center space-y-4">
            <div className="h-14 w-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Invoice Created Successfully!</h2>
            <p className="text-sm text-slate-600 font-mono">
              Document Number: <span className="font-bold text-blue-600">{createdInvoice.documentNumber}</span>
            </p>
            <p className="text-xs text-slate-400">
              Total: {formatPaise(createdInvoice.totalAmountPaise)} • Stock ledger updated atomically
            </p>

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                <Printer className="h-4 w-4" /> Print Thermal / A4
              </button>
              <button
                onClick={() => {
                  setCreatedInvoice(null)
                  setLineItems([])
                  setReceivedAmountRupees('')
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
