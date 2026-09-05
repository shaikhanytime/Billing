import apiClient from '@/lib/api-client'

export interface SaleLineItem {
  id: string
  productId: string
  productName: string
  sku?: string
  barcode?: string
  hsnCode: string
  unit: string
  quantity: number
  unitPricePaise: number
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

export interface SaleInvoice {
  transactionId: string
  documentType: 'SALE_INVOICE' | 'POS_SALE' | 'QUOTATION' | 'SALE_RETURN'
  documentNumber: string
  transactionDate: string
  partyId?: string
  partyName: string
  partyPhone?: string
  partyGstin?: string
  partyStateCode?: string
  placeOfSupply: string
  items: SaleLineItem[]
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
  isPosSale?: boolean
  notes?: string
  createdAt: string
}

export interface CreateSaleInvoicePayload {
  documentType?: 'SALE_INVOICE' | 'POS_SALE' | 'QUOTATION'
  invoiceDate: string
  dueDate?: string
  partyId?: string
  partyName: string
  partyPhone?: string
  partyGstin?: string
  partyStateCode?: string
  placeOfSupply: string
  warehouseId?: string
  items: {
    productId: string
    quantity: number
    unitPricePaise: number
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
  notes?: string
  isPosSale?: boolean
}

export const salesApi = {
  async getInvoices(params?: { documentType?: string; partyId?: string; paymentStatus?: string }): Promise<SaleInvoice[]> {
    const res = await apiClient.get<{ success: boolean; data: SaleInvoice[] }>('/api/sales', { params })
    return res.data.data
  },

  async getInvoiceById(id: string): Promise<SaleInvoice> {
    const res = await apiClient.get<{ success: boolean; data: SaleInvoice }>(`/api/sales/${id}`)
    return res.data.data
  },

  async createInvoice(payload: CreateSaleInvoicePayload): Promise<SaleInvoice> {
    const res = await apiClient.post<{ success: boolean; data: SaleInvoice }>('/api/sales', payload)
    return res.data.data
  },
}
