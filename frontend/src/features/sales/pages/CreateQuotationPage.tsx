import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Trash2,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  Printer,
  ArrowLeft,
  Calendar,
  Layers,
} from 'lucide-react'
import { quotationsApi, CreateQuotationPayload } from '../services/quotations.api'
import { partiesApi, Party } from '../../parties/services/parties.api'
import { inventoryApi, Product } from '../../inventory/services/inventory.api'
import { formatPaise } from '@/lib/utils'

interface LineItemRow {
  productId: string
  productName: string
  sku?: string
  barcode?: string
  hsnCode: string
  baseUnitSymbol: string
  secondaryUnitSymbol?: string
  conversionNumerator: number
  conversionDenominator: number
  selectedUnit: string
  enteredQuantity: number
  unitPricePaise: number
  discountPercent: number
  discountPaise: number
  taxRate: 0 | 5 | 12 | 18 | 28
  isTaxInclusive: boolean
  availableStockBase: number
}

export function CreateQuotationPage() {
  const navigate = useNavigate()
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const [parties, setParties] = useState<Party[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedParty, setSelectedParty] = useState<Party | null>(null)

  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
  const [placeOfSupply, setPlaceOfSupply] = useState('27')
  const [warehouseId, setWarehouseId] = useState('MAIN')

  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [lineItems, setLineItems] = useState<LineItemRow[]>([])

  const [quoteDiscountPaise, setQuoteDiscountPaise] = useState(0)
  const [additionalChargesPaise, setAdditionalChargesPaise] = useState(0)
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState(
    '1. Quotation valid for 30 days from issue date.\n2. Goods once sold will be subject to standard warranty.\n3. Taxes as applicable at time of invoicing.'
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdQuote, setCreatedQuote] = useState<any | null>(null)

  useEffect(() => {
    partiesApi.getParties({ type: 'CUSTOMER' }).then(setParties)
    inventoryApi.getProducts().then(setProducts)
  }, [])

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeQuery.trim()) return

    const trimmed = barcodeQuery.trim()
    const matched = products.find(
      (p) =>
        p.barcode === trimmed ||
        p.secondaryBarcode === trimmed ||
        p.sku?.toLowerCase() === trimmed.toLowerCase()
    )

    if (matched) {
      const isSecondary = matched.secondaryBarcode === trimmed
      addItemToQuotation(matched, isSecondary)
      setBarcodeQuery('')
    } else {
      setError(`Product with barcode/SKU "${barcodeQuery}" not found.`)
    }
  }

  const addItemToQuotation = (product: Product, useSecondaryUnit: boolean = false) => {
    setError(null)
    const baseUnit = product.baseUnitSymbol || 'PCS'
    const secUnit = product.secondaryUnitSymbol
    const num = product.conversionNumerator || 1
    const den = product.conversionDenominator || 1

    const selectedUnit = useSecondaryUnit && secUnit ? secUnit : baseUnit
    let defaultPrice = product.salePrice

    if (selectedUnit !== baseUnit && num > 0) {
      defaultPrice = Math.round((product.salePrice * num) / den)
    }

    setLineItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.productId === product.id && item.selectedUnit === selectedUnit
      )

      if (existingIdx >= 0) {
        const copy = [...prev]
        const current = copy[existingIdx]!
        copy[existingIdx] = {
          ...current,
          enteredQuantity: current.enteredQuantity + 1,
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
            baseUnitSymbol: baseUnit,
            secondaryUnitSymbol: secUnit,
            conversionNumerator: num,
            conversionDenominator: den,
            selectedUnit,
            enteredQuantity: 1,
            unitPricePaise: defaultPrice,
            discountPercent: 0,
            discountPaise: 0,
            taxRate: product.taxRate,
            isTaxInclusive: product.isTaxInclusive || false,
            availableStockBase: (product.stockQty || 0) / 1000,
          },
        ]
      }
    })
  }

  const handleUnitChange = (index: number, newUnit: string) => {
    setLineItems((prev) => {
      const copy = [...prev]
      const item = copy[index]!
      const product = products.find((p) => p.id === item.productId)
      if (!product) return prev

      let newPrice = product.salePrice
      if (newUnit === item.secondaryUnitSymbol && item.conversionNumerator > 0) {
        newPrice = Math.round((product.salePrice * item.conversionNumerator) / item.conversionDenominator)
      }

      copy[index] = {
        ...item,
        selectedUnit: newUnit,
        unitPricePaise: newPrice,
      }
      return copy
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
  const isIntraState = placeOfSupply === '27'

  const calculatedLines = lineItems.map((item) => {
    const isSecondary = item.selectedUnit === item.secondaryUnitSymbol
    const num = isSecondary ? item.conversionNumerator : 1
    const den = isSecondary ? item.conversionDenominator : 1
    const baseQuantity = Math.round((item.enteredQuantity * num) / den)

    const grossLinePaise = Math.round(item.enteredQuantity * item.unitPricePaise)
    const discountPaise =
      Math.round((grossLinePaise * (item.discountPercent || 0)) / 100) + (item.discountPaise || 0)
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
      baseQuantity,
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
    quoteDiscountPaise +
    additionalChargesPaise

  const roundedTotalPaise = Math.round(rawTotalPaise / 100) * 100
  const roundOffPaise = roundedTotalPaise - rawTotalPaise

  const handleSubmitQuotation = async (status: 'DRAFT' | 'SENT' = 'DRAFT') => {
    if (lineItems.length === 0) {
      setError('Please add at least one line item.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const payload: CreateQuotationPayload = {
        quotationDate,
        validUntil,
        partyId: selectedParty?.id,
        partyName: selectedParty?.name || 'Prospective Customer',
        partyPhone: selectedParty?.phone,
        partyGstin: selectedParty?.gstin,
        partyStateCode: selectedParty?.billingAddress?.stateCode || placeOfSupply,
        placeOfSupply,
        warehouseId,
        items: lineItems.map((item) => {
          const isSecondary = item.selectedUnit === item.secondaryUnitSymbol
          return {
            productId: item.productId,
            enteredQuantity: Math.round(item.enteredQuantity * 1000), // Scaled
            enteredUnit: item.selectedUnit,
            conversionNumerator: isSecondary ? item.conversionNumerator : 1,
            conversionDenominator: isSecondary ? item.conversionDenominator : 1,
            unitPricePaise: item.unitPricePaise,
            isTaxInclusive: item.isTaxInclusive,
            discountPercent: item.discountPercent,
            discountPaise: item.discountPaise,
            taxRate: item.taxRate,
          }
        }),
        discountPaise: quoteDiscountPaise,
        additionalChargesPaise,
        notes,
        termsAndConditions: terms,
        status,
      }

      const created = await quotationsApi.createQuotation(payload)
      setCreatedQuote(created)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create quotation.')
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
            onClick={() => navigate('/sales/quotations')}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Quotation / Estimate</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Non-posting commercial proposal with Alternate Unit multi-unit packaging support
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quotation Header Details */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer / Prospective Client <span className="text-red-500">*</span>
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
              <option value="">Prospective Customer (Generic)</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.gstin ? `(${p.gstin})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Quotation Date</label>
            <input
              type="date"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
              className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Valid Until</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Barcode & Product Quick Search */}
      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center">
        <form onSubmit={handleBarcodeSubmit} className="relative flex-1 w-full">
          <Barcode className="absolute left-3.5 top-2.5 h-4 w-4 text-blue-500" />
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeQuery}
            onChange={(e) => setBarcodeQuery(e.target.value)}
            placeholder="Scan product barcode (primary or secondary box barcode)..."
            className="w-full h-10 pl-10 pr-4 text-xs font-mono bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
          />
        </form>

        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <select
            value=""
            onChange={(e) => {
              const p = products.find((x) => x.id === e.target.value)
              if (p) addItemToQuotation(p)
            }}
            className="w-full h-10 pl-10 pr-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          >
            <option value="">Search & Select Item to Quote...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatPaise(p.salePrice)}/{p.baseUnitSymbol}{' '}
                {p.secondaryUnitSymbol ? `(or 1 ${p.secondaryUnitSymbol} = ${p.conversionNumerator} ${p.baseUnitSymbol})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quotation Line Items</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">{lineItems.length} items added</span>
        </div>

        {lineItems.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No items in quotation. Scan a barcode above or select products from the dropdown.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-3">Unit Packaging</th>
                  <th className="py-2.5 px-3 text-center">Quoted Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Rate (₹)</th>
                  <th className="py-2.5 px-3 text-center">Disc %</th>
                  <th className="py-2.5 px-3 text-center">GST %</th>
                  <th className="py-2.5 px-4 text-right">Taxable (₹)</th>
                  <th className="py-2.5 px-4 text-right">Line Total (₹)</th>
                  <th className="py-2.5 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculatedLines.map((item, idx) => (
                  <tr key={`${item.productId}_${item.selectedUnit}`} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        HSN: {item.hsnCode} • Avail: {item.availableStockBase} {item.baseUnitSymbol}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {/* Unit Selector: Base Unit vs Alternate Secondary Unit */}
                      <select
                        value={item.selectedUnit}
                        onChange={(e) => handleUnitChange(idx, e.target.value)}
                        className="h-8 px-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={item.baseUnitSymbol}>{item.baseUnitSymbol} (Base)</option>
                        {item.secondaryUnitSymbol && (
                          <option value={item.secondaryUnitSymbol}>
                            {item.secondaryUnitSymbol} ({item.conversionNumerator}/{item.conversionDenominator} {item.baseUnitSymbol})
                          </option>
                        )}
                      </select>
                      {item.selectedUnit !== item.baseUnitSymbol && (
                        <div className="text-[10px] text-blue-600 font-mono mt-0.5">
                          = {item.baseQuantity} {item.baseUnitSymbol} base
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        min="0.001"
                        step="1"
                        value={item.enteredQuantity}
                        onChange={(e) =>
                          updateLineItem(idx, { enteredQuantity: Number(e.target.value) || 1 })
                        }
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
                        className="w-24 h-8 text-right px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discountPercent}
                        onChange={(e) =>
                          updateLineItem(idx, { discountPercent: Number(e.target.value) || 0 })
                        }
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

      {/* Notes, Terms, and Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions or commercial proposal notes..."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Terms & Conditions</label>
            <textarea
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
        </div>

        {/* Summary Card */}
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
            <span className="text-sm font-bold text-slate-900">Quoted Total:</span>
            <span className="text-2xl font-extrabold text-blue-600 font-mono">
              {formatPaise(roundedTotalPaise)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3">
            <button
              onClick={() => handleSubmitQuotation('DRAFT')}
              disabled={loading || lineItems.length === 0}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmitQuotation('SENT')}
              disabled={loading || lineItems.length === 0}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create & Mark Sent'}
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {createdQuote && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 text-center space-y-4">
            <div className="h-14 w-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Quotation Created Successfully!</h2>
            <p className="text-sm text-slate-600 font-mono">
              Document Number: <span className="font-bold text-blue-600">{createdQuote.documentNumber}</span>
            </p>
            <p className="text-xs text-slate-400">
              Total Quoted: {formatPaise(createdQuote.totalAmountPaise)} • Non-posting commercial snapshot recorded
            </p>

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => navigate('/sales/quotations')}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                View Quotations
              </button>
              <button
                onClick={() => {
                  setCreatedQuote(null)
                  setLineItems([])
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
