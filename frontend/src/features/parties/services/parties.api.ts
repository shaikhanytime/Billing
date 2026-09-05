import apiClient from '@/lib/api-client'

export interface Party {
  id: string
  name: string
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
  category?: string
  phone: string
  email?: string
  gstin?: string
  pan?: string
  billingAddress: {
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
  openingBalance: number
  currentBalance: number
  creditPeriodDays: number
  creditLimit: number
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface PartyLedgerEntry {
  id: string
  partyId: string
  transactionId: string
  documentType: string
  documentNumber: string
  date: string
  debit: number
  credit: number
  balanceSnapshot: number
  description: string
  createdAt: string
}

export const partiesApi = {
  async getParties(params?: { type?: string; search?: string }): Promise<Party[]> {
    const res = await apiClient.get<{ success: boolean; data: Party[] }>('/api/parties', { params })
    return res.data.data
  },

  async getPartyById(id: string): Promise<Party> {
    const res = await apiClient.get<{ success: boolean; data: Party }>(`/api/parties/${id}`)
    return res.data.data
  },

  async createParty(data: Partial<Party>): Promise<Party> {
    const res = await apiClient.post<{ success: boolean; data: Party }>('/api/parties', data)
    return res.data.data
  },

  async getPartyLedger(partyId: string, params?: { startDate?: string; endDate?: string }): Promise<PartyLedgerEntry[]> {
    const res = await apiClient.get<{ success: boolean; data: PartyLedgerEntry[] }>(`/api/parties/${partyId}/ledger`, { params })
    return res.data.data
  },
}
