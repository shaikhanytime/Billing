import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Barcode, Tag, SlidersHorizontal, AlertTriangle, CheckCircle2, ArrowUpDown } from 'lucide-react'
import { inventoryApi, Product } from '../services/inventory.api'
import { CreateProductModal } from '../components/CreateProductModal'
import { StockAdjustmentModal } from '../components/StockAdjustmentModal'
import { formatPaise } from '@/lib/utils'

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const data = await inventoryApi.getProducts({
        search: search || undefined,
        lowStockOnly: lowStockOnly || undefined,
      })
      setProducts(data)
    } catch (err) {
      console.error('Failed to fetch products', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [search, lowStockOnly])

  const totalInventoryValuePaise = products.reduce(
    (sum, p) => sum + (p.purchaseCost || 0) * ((p.stockQty || 0) / 1000),
    0
  )
  const lowStockCount = products.filter((p) => p.stockQty <= p.reorderLevel).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Products & Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain product catalog, pricing tiers, barcode scanning, and multi-warehouse stock
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow-md transition-all active:scale-98"
        >
          <Plus className="h-4 w-4" />
          Add New Item
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Items</span>
          <div className="text-2xl font-bold text-slate-900 mt-1.5">{products.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Stock Valuation</span>
          <div className="text-2xl font-bold text-blue-600 mt-1.5">{formatPaise(totalInventoryValuePaise)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Alerts</span>
          <div className="text-2xl font-bold text-amber-600 mt-1.5 flex items-center gap-2">
            {lowStockCount}
            {lowStockCount > 0 && <AlertTriangle className="h-5 w-5 text-amber-500" />}
          </div>
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
              placeholder="Search by name, SKU, or barcode..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                lowStockOnly
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Low Stock Filter
            </button>
          </div>
        </div>

        {/* Products Table */}
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading product catalog...</div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No products found matching the criteria. Click &quot;Add New Item&quot; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Item Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">HSN / Tax</th>
                  <th className="py-3 px-4 text-right">Sale Price (₹)</th>
                  <th className="py-3 px-4 text-right">Cost Price (₹)</th>
                  <th className="py-3 px-5 text-right">On-Hand Stock</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const stockDisplay = (p.stockQty || 0) / 1000
                  const isLow = p.trackInventory && p.stockQty <= p.reorderLevel

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                          <span>SKU: {p.sku}</span>
                          {p.barcode && <span>• Barcode: {p.barcode}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                          {p.categoryName || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div>HSN: {p.hsnCode}</div>
                        <div className="text-[11px] font-semibold text-blue-600 mt-0.5">
                          GST {p.taxRate}% {p.isTaxInclusive ? '(Incl)' : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatPaise(p.salePrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-500">
                        {formatPaise(p.purchaseCost)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {p.trackInventory ? (
                          <div>
                            <div className={`font-bold ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                              {stockDisplay.toFixed(2)} {p.baseUnitSymbol}
                            </div>
                            {isLow && (
                              <div className="text-[10px] text-amber-600 font-medium">Low Stock</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Service</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {p.trackInventory && (
                          <button
                            onClick={() => setSelectedProductForAdjust(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <SlidersHorizontal className="h-3 w-3" /> Adjust
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateProductModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => fetchProducts()}
      />

      <StockAdjustmentModal
        product={selectedProductForAdjust}
        isOpen={Boolean(selectedProductForAdjust)}
        onClose={() => setSelectedProductForAdjust(null)}
        onSuccess={() => fetchProducts()}
      />
    </div>
  )
}
