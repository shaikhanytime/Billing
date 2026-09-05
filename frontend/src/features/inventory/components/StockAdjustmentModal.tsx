import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { inventoryApi, Product } from '../services/inventory.api'

interface StockAdjustmentModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function StockAdjustmentModal({ product, isOpen, onClose, onSuccess }: StockAdjustmentModalProps) {
  const [targetQuantity, setTargetQuantity] = useState('')
  const [reason, setReason] = useState('PHYSICAL_COUNT_AUDIT')
  const [customReason, setCustomReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !product) return null

  const currentStockUnits = (product.stockQty || 0) / 1000

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const scaledTarget = Math.round(Number(targetQuantity) * 1000)
      const finalReason = customReason ? `${reason}: ${customReason}` : reason

      await inventoryApi.adjustStock({
        productId: product.id,
        targetQuantity: scaledTarget,
        reason: finalReason,
        warehouseId: 'MAIN',
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900">Adjust Stock Quantity</h2>
            <p className="text-xs text-slate-500 mt-0.5">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Current Recorded Stock:</span>
            <span className="font-bold text-slate-900 font-mono">
              {currentStockUnits.toFixed(3)} {product.baseUnitSymbol}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              New Physical Count Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              required
              value={targetQuantity}
              onChange={(e) => setTargetQuantity(e.target.value)}
              placeholder="e.g. 25.000"
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Adjustment Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="PHYSICAL_COUNT_AUDIT">Physical Count Reconciliation</option>
              <option value="DAMAGED_EXPIRED">Damaged / Expired Write-Off</option>
              <option value="THEFT_LOSS">Shrinkage / Unaccounted Loss</option>
              <option value="SURPLUS_FOUND">Surplus Found</option>
              <option value="OTHER">Other Reason</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Audit Notes / Explanation</label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Optional details for audit log..."
              className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Posting...' : 'Commit Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
