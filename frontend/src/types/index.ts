// ─── Auth Types ──────────────────────────────────────────────────────────────
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SALES' | 'PURCHASE' | 'WAREHOUSE'

export interface AppUser {
  uid: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  orgId: string
  branchId?: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  createdAt: string
  updatedAt: string
}

// ─── Organization ─────────────────────────────────────────────────────────────
export interface Organization {
  id: string
  name: string
  legalName?: string
  email?: string
  phone?: string
  gstNumber?: string
  pan?: string
  address?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface Branch {
  id: string
  orgId: string
  name: string
  code: string
  email?: string
  phone?: string
  address?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface Warehouse {
  id: string
  orgId: string
  branchId: string
  name: string
  code: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export interface Category {
  id: string
  orgId: string
  name: string
  parentId?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
}

export interface Unit {
  id: string
  orgId: string
  name: string
  symbol: string
  createdAt: string
}

export type BarcodeType = 'EAN13' | 'CODE128' | 'QR'

export interface BarcodeEntry {
  value: string
  type: BarcodeType
  isPrimary: boolean
}

export interface Product {
  id: string
  orgId: string
  name: string
  sku: string
  description?: string
  categoryId?: string
  unitId?: string
  salePrice: number
  purchasePrice: number
  mrp: number
  hsnCode?: string
  taxRate: 0 | 5 | 12 | 18 | 28
  isTaxable: boolean
  trackInventory: boolean
  barcodes: BarcodeEntry[]
  status: 'ACTIVE' | 'INACTIVE'
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface StockLevel {
  id: string         // same as productId
  orgId: string
  productId: string
  warehouseId?: string
  quantityOnHand: number
  reorderLevel: number
  lastUpdated: string
}

export type StockMovementType = 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'OPENING' | 'TRANSFER'

export interface StockMovement {
  id: string
  orgId: string
  productId: string
  warehouseId?: string
  type: StockMovementType
  referenceType?: string
  referenceId?: string
  quantity: number  // positive = in, negative = out
  unitCost?: number
  balanceAfter: number
  note?: string
  createdBy: string
  createdAt: string
}

// ─── Parties ──────────────────────────────────────────────────────────────────
export interface Customer {
  id: string
  orgId: string
  name: string
  phone?: string
  email?: string
  gstNumber?: string
  panNumber?: string
  billingAddress?: string
  shippingAddress?: string
  creditLimit: number
  creditDays: number
  openingBalance: number  // positive = they owe us
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface Supplier {
  id: string
  orgId: string
  name: string
  phone?: string
  email?: string
  gstNumber?: string
  panNumber?: string
  address?: string
  paymentTerms?: string
  openingBalance: number  // positive = we owe them
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export type PartyType = 'CUSTOMER' | 'SUPPLIER'
export type LedgerTransactionType = 'INVOICE' | 'PAYMENT' | 'RETURN' | 'ADJUSTMENT' | 'OPENING'

export interface PartyLedgerEntry {
  id: string
  orgId: string
  partyType: PartyType
  partyId: string
  transactionType: LedgerTransactionType
  referenceId?: string
  debit: number
  credit: number
  balanceAfter: number
  note?: string
  createdBy: string
  createdAt: string
}

// ─── Billing ──────────────────────────────────────────────────────────────────
export type InvoiceType = 'INVOICE' | 'QUOTATION'
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'
export type PaymentMode = 'CASH' | 'CHEQUE' | 'UPI' | 'NEFT' | 'CARD' | 'OTHER'

export interface InvoiceItem {
  productId: string
  productName: string
  hsnCode?: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxableAmount: number
  taxRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  taxAmount: number
  totalAmount: number
}

export interface SaleInvoice {
  id: string
  orgId: string
  invoiceNumber: string
  invoiceType: InvoiceType
  customerId: string
  customerName: string
  branchId?: string
  warehouseId?: string
  invoiceDate: string
  dueDate?: string
  subtotal: number
  discountAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalAmount: number
  paidAmount: number
  balanceDue: number
  paymentStatus: PaymentStatus
  items: InvoiceItem[]
  notes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseInvoice {
  id: string
  orgId: string
  invoiceNumber: string
  supplierInvoiceNumber?: string
  supplierId: string
  supplierName: string
  branchId?: string
  warehouseId?: string
  invoiceDate: string
  dueDate?: string
  subtotal: number
  discountAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalAmount: number
  paidAmount: number
  balanceDue: number
  paymentStatus: PaymentStatus
  items: InvoiceItem[]
  notes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface PaymentReceived {
  id: string
  orgId: string
  paymentNumber: string
  customerId: string
  customerName: string
  paymentDate: string
  amount: number
  paymentMode: PaymentMode
  referenceNumber?: string
  allocations: { invoiceId: string; invoiceNumber: string; allocatedAmount: number }[]
  note?: string
  createdBy: string
  createdAt: string
}

export interface PaymentMade {
  id: string
  orgId: string
  paymentNumber: string
  supplierId: string
  supplierName: string
  paymentDate: string
  amount: number
  paymentMode: PaymentMode
  referenceNumber?: string
  allocations: { invoiceId: string; invoiceNumber: string; allocatedAmount: number }[]
  note?: string
  createdBy: string
  createdAt: string
}

// ─── API / UI Helpers ─────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  error?: { code: string; details?: unknown }
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalCustomers: number
  totalSuppliers: number
  totalProducts: number
  totalBranches: number
  todaySales: number
  todayPurchases: number
  totalOutstanding: number
  lowStockCount: number
}
