import apiClient from '@/lib/api-client'

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  additionalBarcodes?: string[]
  hsnCode: string
  categoryId: string
  categoryName?: string
  baseUnitId: string
  baseUnitSymbol: string
  purchaseCost: number
  salePrice: number
  mrp: number
  isTaxInclusive: boolean
  taxRate: 0 | 5 | 12 | 18 | 28
  trackInventory: boolean
  stockQty: number
  reorderLevel: number
  lowStockWarning: boolean
  brand?: string
  rackLocation?: string
  description?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface StockMovement {
  id: string
  productId: string
  movementType: string
  referenceType: string
  referenceNumber: string
  baseQuantity: number
  unitCost: number
  totalValuation: number
  balanceSnapshot: number
  occurredAt: string
}

export const inventoryApi = {
  async getProducts(params?: { search?: string; categoryId?: string; lowStockOnly?: boolean }): Promise<Product[]> {
    const res = await apiClient.get<{ success: boolean; data: Product[] }>('/api/inventory/products', { params })
    return res.data.data
  },

  async getProductById(id: string): Promise<Product> {
    const res = await apiClient.get<{ success: boolean; data: Product }>(`/api/inventory/products/${id}`)
    return res.data.data
  },

  async createProduct(data: Partial<Product> & { initialStock?: number; initialCostPaise?: number; warehouseId?: string }): Promise<Product> {
    const res = await apiClient.post<{ success: boolean; data: Product }>('/api/inventory/products', data)
    return res.data.data
  },

  async adjustStock(data: { productId: string; targetQuantity: number; reason: string; warehouseId?: string }): Promise<void> {
    await apiClient.post('/api/inventory/adjust', data)
  },

  async getMovements(productId: string): Promise<StockMovement[]> {
    const res = await apiClient.get<{ success: boolean; data: StockMovement[] }>(`/api/inventory/products/${productId}/movements`)
    return res.data.data
  },
}
