import { useState } from 'react'
import { X, Barcode, DollarSign, Package, Layers, Tag, Sparkles, AlertCircle } from 'lucide-react'
import { inventoryApi, Product } from '../services/inventory.api'
import { generateEAN13, generateSKU } from '@/lib/utils'

interface CreateProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (product: Product) => void
}

export function CreateProductModal({ isOpen, onClose, onSuccess }: CreateProductModalProps) {
  const [activeTab, setActiveTab] = useState<'BASIC' | 'STOCK' | 'PRICING' | 'PARTY_PRICES' | 'CUSTOM'>('BASIC')
  
  // Basic Details
  const [itemType, setItemType] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT')
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [hsnCode, setHsnCode] = useState('')
  const [categoryId, setCategoryId] = useState('CAT-GENERAL')
  const [categoryName, setCategoryName] = useState('General')
  const [baseUnitSymbol, setBaseUnitSymbol] = useState('PCS')

  // Stock & Barcode
  const [barcode, setBarcode] = useState('')
  const [initialStock, setInitialStock] = useState('')
  const [initialCostRupees, setInitialCostRupees] = useState('')
  const [reorderLevel, setReorderLevel] = useState('10')
  const [lowStockWarning, setLowStockWarning] = useState(true)
  const [warehouseId, setWarehouseId] = useState('MAIN')

  // Pricing
  const [salePriceRupees, setSalePriceRupees] = useState('')
  const [mrpRupees, setMrpRupees] = useState('')
  const [isTaxInclusive, setIsTaxInclusive] = useState(false)
  const [taxRate, setTaxRate] = useState<0 | 5 | 12 | 18 | 28>(18)

  // Custom Fields
  const [brand, setBrand] = useState('')
  const [rackLocation, setRackLocation] = useState('')
  const [description, setDescription] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleGenerateBarcode = () => {
    setBarcode(generateEAN13())
  }

  const handleAutoSKU = () => {
    if (name.trim()) {
      setSku(generateSKU(name))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const salePricePaise = Math.round(Number(salePriceRupees || 0) * 100)
      const purchaseCostPaise = Math.round(Number(initialCostRupees || 0) * 100)
      const mrpPaise = Math.round(Number(mrpRupees || salePriceRupees || 0) * 100)
      const initialStockScaled = Math.round(Number(initialStock || 0) * 1000)
      const reorderLevelScaled = Math.round(Number(reorderLevel || 0) * 1000)

      const product = await inventoryApi.createProduct({
        name,
        sku: sku || generateSKU(name || 'PROD'),
        barcode: barcode || generateEAN13(),
        hsnCode: hsnCode || 'N/A',
        categoryId,
        categoryName,
        baseUnitId: baseUnitSymbol,
        baseUnitSymbol,
        purchaseCost: purchaseCostPaise,
        salePrice: salePricePaise,
        mrp: mrpPaise,
        isTaxInclusive,
        taxRate,
        trackInventory: itemType === 'PRODUCT',
        reorderLevel: reorderLevelScaled,
        lowStockWarning,
        brand: brand || undefined,
        rackLocation: rackLocation || undefined,
        description: description || undefined,
        initialStock: initialStockScaled,
        initialCostPaise: purchaseCostPaise,
        warehouseId,
      })

      onSuccess(product)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create product.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Create New Item</h2>
            <p className="text-xs text-slate-500 mt-0.5">Configure 5-tab item parameters and stock valuations</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 5 Tabs Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/30 gap-1 overflow-x-auto">
          {[
            { id: 'BASIC', label: '1. Basic Details', icon: Package },
            { id: 'STOCK', label: '2. Stock & Barcode', icon: Barcode },
            { id: 'PRICING', label: '3. Pricing & Tax', icon: DollarSign },
            { id: 'PARTY_PRICES', label: '4. Party Pricing', icon: Tag },
            { id: 'CUSTOM', label: '5. Custom Fields', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-white shadow-xs rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: BASIC DETAILS */}
          {activeTab === 'BASIC' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-xs font-semibold text-slate-700">Item Type:</label>
                <div className="flex gap-2">
                  {(['PRODUCT', 'SERVICE'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setItemType(t)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        itemType === t
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {t === 'PRODUCT' ? 'Physical Product (Stock Tracked)' : 'Service (No Inventory)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleAutoSKU}
                  placeholder="e.g. Parle-G Gold Biscuit 200g"
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">SKU / Item Code</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value.toUpperCase())}
                      placeholder="PARL-8921"
                      className="w-full h-10 px-3 text-sm font-mono uppercase border border-r-0 border-slate-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={handleAutoSKU}
                      className="px-3 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-r-lg text-slate-700 hover:bg-slate-200"
                    >
                      Auto
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">HSN / SAC Code</label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="19053100"
                    className="w-full h-10 px-3 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={categoryName}
                    onChange={(e) => {
                      setCategoryName(e.target.value)
                      setCategoryId(`CAT-${e.target.value.toUpperCase()}`)
                    }}
                    className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    <option value="General">General</option>
                    <option value="Groceries">Groceries & Foods</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Hardware">Hardware & Tools</option>
                    <option value="Stationery">Stationery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Base Unit</label>
                  <select
                    value={baseUnitSymbol}
                    onChange={(e) => setBaseUnitSymbol(e.target.value)}
                    className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="BOX">BOX (Boxes)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="GM">GM (Grams)</option>
                    <option value="LTR">LTR (Liters)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="PACK">PACK (Packs)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STOCK & BARCODE */}
          {activeTab === 'STOCK' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Barcode (EAN-13 / UPC / Code-128)
                </label>
                <div className="flex">
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="e.g. 8901234567890"
                    className="w-full h-10 px-3 text-sm font-mono border border-r-0 border-slate-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="flex items-center gap-1.5 px-3.5 text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700 rounded-r-lg hover:bg-blue-100"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate EAN-13
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Opening Stock Quantity</label>
                  <input
                    type="number"
                    step="0.001"
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    placeholder="0.000"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Purchase Rate per Unit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={initialCostRupees}
                    onChange={(e) => setInitialCostRupees(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Low Stock Alert Threshold</label>
                  <input
                    type="number"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    placeholder="10"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Warehouse Location</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    <option value="MAIN">Main Central Warehouse</option>
                    <option value="STORE_FRONT">Retail Store Front</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRICING & TAX */}
          {activeTab === 'PRICING' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Selling Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={salePriceRupees}
                    onChange={(e) => setSalePriceRupees(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">MRP (Maximum Retail Price ₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={mrpRupees}
                    onChange={(e) => setMrpRupees(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">GST Tax Rate</label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value) as any)}
                    className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
                  >
                    <option value={0}>0% (Exempted / Nil Rated)</option>
                    <option value={5}>5% (GST 5%)</option>
                    <option value={12}>12% (GST 12%)</option>
                    <option value={18}>18% (Standard GST 18%)</option>
                    <option value={28}>28% (Luxury / Sin GST 28%)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTaxInclusive}
                      onChange={(e) => setIsTaxInclusive(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Selling price is inclusive of GST tax</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PARTY PRICING */}
          {activeTab === 'PARTY_PRICES' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Party-Specific Pricing Rules</p>
                <p className="mt-1">
                  Configure wholesale tiers, distributor discounts, or customer category custom rates.
                </p>
              </div>
              <div className="text-center py-6 text-xs text-slate-400">
                Tier price rules will automatically apply when invoicing selected party categories.
              </div>
            </div>
          )}

          {/* TAB 5: CUSTOM FIELDS */}
          {activeTab === 'CUSTOM' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Parle / Samsung"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Rack / Shelf Location</label>
                  <input
                    type="text"
                    value={rackLocation}
                    onChange={(e) => setRackLocation(e.target.value)}
                    placeholder="Aisle 4, Shelf B"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Item Description / Notes</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional product description for invoices..."
                  className="w-full p-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <div className="text-xs text-slate-400">
            Step {activeTab === 'BASIC' ? '1' : activeTab === 'STOCK' ? '2' : activeTab === 'PRICING' ? '3' : activeTab === 'PARTY_PRICES' ? '4' : '5'} of 5
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Save Product'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
