import apiClient from '@/lib/api-client'

export interface PurchaseLineItem {
  id: string
  productId: string
  productName: string
  sku?: string
  barcode?: string
  hsnCode: string
  unit: string
  quantity: number
  unitCostPaise: number
  isTaxInclusive: boolean
  discountPercent: number
  discountPaise: number
  taxRate: 0 | 5 | 12 | 18 | 28
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  totalTaxPaise: number
  totalPaise: number
}

export interface PurchaseInvoice {
  transactionId: string
  documentType: 'PURCHASE_INVOICE' | 'PURCHASE_RETURN'
  documentNumber: string
  vendorBillNumber: string
  vendorBillDate: string
  transactionDate: string
  partyId: string
  partyName: string
  partyGstin?: string
  partyStateCode?: string
  placeOfSupply: string
  items: PurchaseLineItem[]
  subtotalPaise: number
  taxableAmountPaise: number
  cgstAmountPaise: number
  sgstAmountPaise: number
  igstAmountPaise: number
  totalTaxPaise: number
  discountPaise: number
  additionalChargesPaise: number
  roundOffPaise: number
  totalAmountPaise: number
  paidAmountPaise: number
  balanceDuePaise: number
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID'
  rcmApplicable: boolean
  notes?: string
  createdAt: string
}

export interface CreatePurchaseInvoicePayload {
  documentType?: 'PURCHASE_INVOICE' | 'PURCHASE_RETURN'
  vendorBillNumber: string
  vendorBillDate: string
  invoiceDate: string
  dueDate?: string
  partyId: string
  partyName: string
  partyGstin?: string
  partyStateCode?: string
  placeOfSupply: string
  warehouseId?: string
  items: {
    productId: string
    quantity: number
    unitCostPaise: number
    isTaxInclusive?: boolean
    discountPercent?: number
    discountPaise?: number
    taxRate: 0 | 5 | 12 | 18 | 28
  }[]
  discountPaise?: number
  additionalChargesPaise?: number
  payment?: {
    paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE'
    amountPaise: number
    bankAccountId?: string
    referenceNumber?: string
  }
  rcmApplicable?: boolean
  notes?: string
}

export const purchasesApi = {
  async getInvoices(params?: { partyId?: string; paymentStatus?: string }): Promise<PurchaseInvoice[]> {
    const res = await apiClient.get<{ success: boolean; data: PurchaseInvoice[] }>('/api/purchases', { params })
    return res.data?.data ?? []
  },

  async getInvoiceById(id: string): Promise<PurchaseInvoice> {
    const res = await apiClient.get<{ success: boolean; data: PurchaseInvoice }>(`/api/purchases/${id}`)
    return res.data.data
  },

  async createInvoice(payload: CreatePurchaseInvoicePayload): Promise<PurchaseInvoice> {
    const res = await apiClient.post<{ success: boolean; data: PurchaseInvoice }>('/api/purchases', payload)
    return res.data.data
  },
}
