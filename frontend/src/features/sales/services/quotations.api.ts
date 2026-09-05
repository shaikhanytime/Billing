import apiClient from '@/lib/api-client'
import { SaleInvoice } from './sales.api'

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'EXPIRED' | 'DECLINED'

export interface QuotationLineItem {
  id: string
  productId: string
  productName: string
  sku?: string
  barcode?: string
  hsnCode: string
  enteredQuantity: number
  enteredUnit: string
  conversionNumerator: number
  conversionDenominator: number
  baseQuantity: number
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

export interface Quotation {
  id: string
  organizationId: string
  financialPeriodId: string
  documentType: 'QUOTATION'
  documentNumber: string
  quotationStatus: QuotationStatus
  quotationDate: string
  validUntil: string
  partyId?: string
  partyName: string
  partyPhone?: string
  partyGstin?: string
  partyStateCode?: string
  billingAddress?: {
    street: string
    city: string
    state: string
    pincode: string
    stateCode: string
  }
  shippingAddress?: {
    street: string
    city: string
    state: string
    pincode: string
    stateCode?: string
  }
  placeOfSupply: string
  warehouseId: string
  locationId?: string
  items: QuotationLineItem[]
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
  notes?: string
  termsAndConditions?: string
  convertedToInvoiceId?: string
  convertedAt?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateQuotationPayload {
  quotationDate: string
  validUntil?: string
  partyId?: string
  partyName: string
  partyPhone?: string
  partyGstin?: string
  partyStateCode?: string
  billingAddress?: {
    street: string
    city: string
    state: string
    pincode: string
    stateCode: string
  }
  shippingAddress?: {
    street: string
    city: string
    state: string
    pincode: string
    stateCode?: string
  }
  placeOfSupply: string
  warehouseId?: string
  items: {
    productId: string
    enteredQuantity: number
    enteredUnit?: string
    conversionNumerator?: number
    conversionDenominator?: number
    unitPricePaise?: number
    isTaxInclusive?: boolean
    discountPercent?: number
    discountPaise?: number
    taxRate: 0 | 5 | 12 | 18 | 28
  }[]
  discountPaise?: number
  additionalChargesPaise?: number
  notes?: string
  termsAndConditions?: string
  status?: QuotationStatus
}

export const quotationsApi = {
  async getQuotations(params?: {
    status?: QuotationStatus
    partyId?: string
    startDate?: string
    endDate?: string
    search?: string
  }): Promise<Quotation[]> {
    const res = await apiClient.get<{ success: boolean; data: Quotation[] }>('/api/sales/quotations', { params })
    return res.data.data
  },

  async getQuotationById(id: string): Promise<Quotation> {
    const res = await apiClient.get<{ success: boolean; data: Quotation }>(`/api/sales/quotations/${id}`)
    return res.data.data
  },

  async createQuotation(payload: CreateQuotationPayload): Promise<Quotation> {
    const res = await apiClient.post<{ success: boolean; data: Quotation }>('/api/sales/quotations', payload)
    return res.data.data
  },

  async updateStatus(id: string, status: QuotationStatus): Promise<Quotation> {
    const res = await apiClient.patch<{ success: boolean; data: Quotation }>(`/api/sales/quotations/${id}/status`, { status })
    return res.data.data
  },

  async convertToInvoice(id: string): Promise<{ invoice: SaleInvoice; quotation: Quotation }> {
    const res = await apiClient.post<{ success: boolean; message: string; data: { invoice: SaleInvoice; quotation: Quotation } }>(
      `/api/sales/quotations/${id}/convert`
    )
    return res.data.data
  },
}
