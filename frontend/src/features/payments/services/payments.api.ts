import apiClient from '@/lib/api-client'

export type PaymentVoucherStatus = 'POSTED' | 'REVERSED'

export interface PaymentAllocation {
  id: string
  orgId: string
  paymentId: string
  invoiceId: string
  invoiceType: 'SALE_INVOICE' | 'PURCHASE_INVOICE'
  invoiceNumber?: string
  paymentAllocatedPaise: number
  discountAllocatedPaise: number
  settlementAllocatedPaise: number
  allocatedAmount?: number
  allocatedAt: string
}

export interface AdvanceAllocation {
  id: string
  orgId: string
  sourcePaymentId: string
  sourcePaymentDocumentNumber: string
  invoiceId: string
  invoiceNumber: string
  invoiceType: 'SALE_INVOICE' | 'PURCHASE_INVOICE'
  amountPaise: number
  status: 'APPLIED' | 'REVERSED'
  appliedAt: string
  reversedAt?: string
  reversedBy?: string
  reversalReason?: string
}

export interface PaymentVoucher {
  transactionId: string
  organizationId: string
  financialPeriodId: string
  documentType: 'PAYMENT_IN' | 'PAYMENT_OUT'
  documentNumber: string
  transactionDate: string
  postingDate: string
  partyId: string
  partyName: string
  partyType: 'CUSTOMER' | 'SUPPLIER'
  paymentAmountPaise: number
  discountPaise: number
  settlementAmountPaise: number
  unallocatedPaymentAmountPaise: number
  totalAmount?: number
  discountAmount?: number
  unallocatedAmount?: number
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE'
  bankAccountId?: string
  referenceNumber?: string
  allocations: {
    allocationId?: string
    invoiceId: string
    invoiceNumber: string
    invoiceType?: 'SALE_INVOICE' | 'PURCHASE_INVOICE'
    paymentAllocatedPaise: number
    discountAllocatedPaise: number
    settlementAllocatedPaise: number
    allocatedAmount?: number
  }[]
  status: PaymentVoucherStatus
  reversalReason?: string
  reversedAt?: string
  reversedBy?: string
  notes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreatePaymentPayload {
  type: 'PAYMENT_IN' | 'PAYMENT_OUT'
  partyId: string
  partyName: string
  partyType: 'CUSTOMER' | 'SUPPLIER'
  paymentAmountPaise?: number
  paymentAmountRupees?: number
  discountPaise?: number
  discountRupees?: number
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE'
  bankAccountId?: string
  referenceNumber?: string
  transactionDate?: string
  autoAllocateFIFO?: boolean
  allocations?: {
    invoiceId: string
    invoiceNumber?: string
    invoiceType?: 'SALE_INVOICE' | 'PURCHASE_INVOICE'
    paymentAllocatedPaise?: number
    discountAllocatedPaise?: number
    allocatedAmountRupees?: number
  }[]
  notes?: string
}

export interface EligibleInvoice {
  transactionId: string
  documentNumber: string
  transactionDate: string
  dueDate?: string
  totalAmountPaise: number
  paidAmountPaise: number
  balanceDuePaise: number
  paymentStatus: string
}

export interface AvailableAdvance {
  paymentId: string
  documentNumber: string
  transactionDate: string
  originalAdvancePaise: number
  appliedAdvancePaise: number
  availableAdvancePaise: number
}

export const paymentsApi = {
  async getPayments(params?: {
    type?: 'PAYMENT_IN' | 'PAYMENT_OUT'
    partyId?: string
    paymentMode?: string
    status?: string
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<PaymentVoucher[]> {
    const res = await apiClient.get<{ success: boolean; data: PaymentVoucher[] }>('/api/payments', { params })
    return res.data?.data ?? []
  },

  async getPaymentById(id: string): Promise<PaymentVoucher> {
    const res = await apiClient.get<{ success: boolean; data: PaymentVoucher }>(`/api/payments/${id}`)
    return res.data.data
  },

  async recordPayment(payload: CreatePaymentPayload): Promise<PaymentVoucher> {
    const res = await apiClient.post<{ success: boolean; data: PaymentVoucher }>('/api/payments', payload)
    return res.data.data
  },

  async reversePayment(id: string, reason: string): Promise<PaymentVoucher> {
    const res = await apiClient.post<{ success: boolean; message: string; data: PaymentVoucher }>(
      `/api/payments/${id}/reverse`,
      { reason }
    )
    return res.data.data
  },

  async getEligibleInvoices(partyId: string, partyType: 'CUSTOMER' | 'SUPPLIER'): Promise<EligibleInvoice[]> {
    const res = await apiClient.get<{ success: boolean; data: EligibleInvoice[] }>(
      `/api/payments/eligible-invoices/${partyId}`,
      { params: { partyType } }
    )
    return res.data?.data ?? []
  },

  async getAvailableAdvances(partyId: string): Promise<AvailableAdvance[]> {
    const res = await apiClient.get<{ success: boolean; data: AvailableAdvance[] }>(
      `/api/payments/available-advances/${partyId}`
    )
    return res.data?.data ?? []
  },

  async applyAdvance(payload: {
    sourcePaymentId: string
    invoiceId: string
    invoiceType: 'SALE_INVOICE' | 'PURCHASE_INVOICE'
    amountPaise?: number
    amountRupees?: number
  }): Promise<AdvanceAllocation> {
    const res = await apiClient.post<{ success: boolean; message: string; data: AdvanceAllocation }>(
      '/api/payments/apply-advance',
      payload
    )
    return res.data.data
  },

  async reverseAdvanceAllocation(id: string, reason: string): Promise<AdvanceAllocation> {
    const res = await apiClient.post<{ success: boolean; message: string; data: AdvanceAllocation }>(
      `/api/payments/advance-allocations/${id}/reverse`,
      { reason }
    )
    return res.data.data
  },
}
