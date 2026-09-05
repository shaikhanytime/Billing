/**
 * BillingAnytime Phase 2.1 — Production Domain Entity Definitions
 * All monetary amounts in database & internal domain services are stored in Paise (Integers).
 * Unit costs / WAC are stored in Micro-Paise (Scale 10,000).
 * Quantities are stored in Product Canonical Base Units with scale 1,000 (3 decimal places).
 */

export type TransactionStatus = 'DRAFT' | 'POSTED' | 'CANCELLED' | 'REVERSED';

export type DocumentType =
  | 'SALE_INVOICE'
  | 'POS_SALE'
  | 'QUOTATION'
  | 'SALE_RETURN'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN'
  | 'PAYMENT_IN'
  | 'PAYMENT_OUT'
  | 'EXPENSE'
  | 'STOCK_ADJUSTMENT'
  | 'STOCK_TRANSFER'
  | 'CONTRA_TRANSFER';

export interface TransactionEnvelope {
  transactionId: string;
  organizationId: string;
  financialPeriodId: string;
  documentType: DocumentType;
  documentNumber: string;
  transactionDate: string; // ISO 8601 YYYY-MM-DD
  postingDate: string;     // ISO 8601 timestamp
  status: TransactionStatus;
  locationId: string;
  warehouseId: string;
  partyId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
  reversalOf?: string;
  reversalReason?: string;
}

export interface FinancialPeriod {
  id: string;              // "FY-2026-27"
  orgId: string;
  name: string;            // "Financial Year 2026-2027"
  startDate: string;       // "2026-04-01"
  endDate: string;         // "2027-03-31"
  status: 'OPEN' | 'CLOSED';
  closedAt?: string;
  closedBy?: string;
}

export interface DocumentSequence {
  id: string;              // "${periodId}_${documentType}"
  orgId: string;
  financialPeriodId: string;
  documentType: DocumentType;
  prefix: string;          // e.g. "INV-2627-"
  currentValue: number;
  paddingLength: number;
  updatedAt: string;
}

export interface IdempotencyRecord {
  id: string;              // idempotencyKey
  orgId: string;
  transactionId: string;
  resultRef: string;       // Document path
  status: 'IN_PROGRESS' | 'COMMITTED' | 'FAILED';
  requestPayloadHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuditLog {
  id: string;
  orgId: string;
  actorUid: string;
  actorEmail?: string;
  action: 'CREATE' | 'UPDATE' | 'POST' | 'CANCEL' | 'REVERSE' | 'ADJUST_STOCK' | 'ROLE_CHANGE';
  entityType: DocumentType | 'PRODUCT' | 'PARTY' | 'SETTINGS';
  entityId: string;
  entityNumber?: string;
  timestamp: string;
  diff?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
}

export interface Party {
  id: string;
  orgId: string;
  name: string;
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  category?: string;
  phone: string;
  email?: string;
  gstin?: string;
  pan?: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode?: string;
  };
  openingBalance: number;       // In Paise (+ = Dr/Receivable, - = Cr/Payable)
  currentBalance: number;       // Cached derived balance (In Paise)
  creditPeriodDays: number;
  creditLimit: number;          // In Paise
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface PartyLedgerEntry {
  id: string;
  orgId: string;
  partyId: string;
  transactionId: string;
  documentType: DocumentType;
  documentNumber: string;
  date: string;
  debit: number;                 // Paise (authoritative fact)
  credit: number;                // Paise (authoritative fact)
  balanceSnapshot: number;       // Informational cache
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface PartyPriceRule {
  id: string;
  orgId: string;
  partyId?: string;
  partyCategory?: string;
  productId: string;
  price: number;                 // Net price in Paise
  minimumQuantity: number;       // Scaled base units
  priceType: 'FIXED' | 'DISCOUNT_PERCENT';
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface Product {
  id: string;
  orgId: string;
  itemType: 'PRODUCT' | 'SERVICE';
  name: string;
  sku: string;
  barcode: string;
  additionalBarcodes?: string[];
  hsnCode: string;
  categoryId: string;
  categoryName?: string;
  baseUnitId: string;            // e.g. "PCS"
  baseUnitSymbol: string;
  purchaseCost: number;          // Default purchase cost (Paise)
  salePrice: number;             // Default selling price (Paise)
  mrp: number;                   // Maximum retail price (Paise)
  minWholesalePrice?: number;    // In Paise
  isTaxInclusive: boolean;
  taxRate: 0 | 5 | 12 | 18 | 28;
  trackInventory: boolean;
  stockQty: number;              // Cached display aggregate (scaled base units)
  reorderLevel: number;          // Threshold (scaled base units)
  lowStockWarning: boolean;
  secondaryUnitSymbol?: string;
  conversionNumerator?: number;  // Base units per secondary unit (e.g. 24)
  conversionDenominator?: number;// e.g. 1
  secondaryBarcode?: string;     // Specific barcode for secondary packaging
  brand?: string;
  rackLocation?: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface StockBalance {
  id: string;                    // `${orgId}_${locId}_${whId}_${productId}`
  orgId: string;
  locationId: string;
  warehouseId: string;
  productId: string;
  quantity: number;              // Authoritative on-hand in Scaled Base Units (Scale 1000)
  averageCost: number;           // Authoritative WAC in Micro-Paise (Scale 10,000)
  updatedAt: string;
}

export type StockMovementType =
  | 'INWARD_PURCHASE'
  | 'OUTWARD_SALE'
  | 'INWARD_SALE_RETURN'
  | 'OUTWARD_PURCHASE_RETURN'
  | 'ADJUSTMENT_WRITE_OFF'
  | 'ADJUSTMENT_SURPLUS'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'OPENING_STOCK';

export interface StockMovement {
  id: string;
  orgId: string;
  locationId: string;
  warehouseId: string;
  productId: string;
  movementType: StockMovementType;
  referenceType: DocumentType;
  referenceId: string;           // transactionId
  referenceNumber: string;
  baseQuantity: number;          // Signed Scaled Base Units: + for Inward, - for Outward
  unitCost: number;              // Micro-Paise at time of movement
  totalValuation: number;        // in Paise
  balanceSnapshot: number;       // Informational cache
  occurredAt: string;
  createdBy: string;
}

export interface UnitConversion {
  id: string;
  orgId: string;
  productId?: string;
  fromUnit: string;              // Secondary unit (e.g. "BOX")
  toBaseUnit: string;            // Canonical base unit (e.g. "PCS")
  conversionNumerator: number;   // e.g. 24
  conversionDenominator: number; // e.g. 1
  multiplier?: number;           // Derived helper
  barcode?: string;              // Specific barcode for secondary packaging
  salePricePaise?: number;       // Packaged selling price in Paise
  purchaseCostPaise?: number;    // Packaged purchase rate in Paise
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  orgId: string;
  name: string;
  parentId?: string;
  createdAt: string;
}

export interface Unit {
  id: string;
  orgId: string;
  name: string;                  // "Pieces"
  symbol: string;                // "PCS"
  precision: number;             // Decimal places (0 to 3)
}

export interface PaymentAllocation {
  id: string;
  orgId: string;
  paymentId: string;
  invoiceId: string;
  invoiceType: 'SALE_INVOICE' | 'PURCHASE_INVOICE';
  allocatedAmount: number;       // In Paise
  allocatedAt: string;
}

export interface PaymentVoucher extends TransactionEnvelope {
  documentType: 'PAYMENT_IN' | 'PAYMENT_OUT';
  partyId: string;
  partyName: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  totalAmount: number;           // In Paise
  discountAmount: number;        // Cash discount allowed/received in Paise
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE';
  bankAccountId?: string;
  referenceNumber?: string;
  unallocatedAmount: number;     // Advance remaining (Paise)
  allocations: {
    invoiceId: string;
    invoiceNumber: string;
    allocatedAmount: number;     // In Paise
  }[];
  notes?: string;
}

export interface SaleLineItem {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  hsnCode: string;
  unit: string;
  quantity: number;              // Scaled base units (e.g. 1000 = 1.000)
  unitPricePaise: number;        // In Paise (e.g. 10000 = ₹100.00)
  isTaxInclusive: boolean;
  discountPercent: number;       // e.g. 5 for 5%
  discountPaise: number;
  taxRate: 0 | 5 | 12 | 18 | 28;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  totalPaise: number;
  costPriceMicroPaise?: number;  // Authoritative WAC snapshot at time of sale
}

export interface SaleInvoice extends TransactionEnvelope {
  documentType: 'SALE_INVOICE' | 'POS_SALE' | 'QUOTATION' | 'SALE_RETURN';
  partyName: string;
  partyPhone?: string;
  partyGstin?: string;
  partyStateCode?: string;
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode?: string;
  };
  placeOfSupply: string;
  dueDate: string;
  items: SaleLineItem[];
  subtotalPaise: number;
  taxableAmountPaise: number;
  cgstAmountPaise: number;
  sgstAmountPaise: number;
  igstAmountPaise: number;
  totalTaxPaise: number;
  discountPaise: number;
  additionalChargesPaise: number;
  roundOffPaise: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  balanceDuePaise: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  isPosSale?: boolean;
  notes?: string;
  termsAndConditions?: string;
  eWayBillNumber?: string;
  eInvoiceIrn?: string;
  eInvoiceQrCode?: string;
}

export interface PurchaseLineItem {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  hsnCode: string;
  unit: string;
  quantity: number;              // Scaled base units
  unitCostPaise: number;         // Purchase rate per base unit in Paise
  isTaxInclusive: boolean;
  discountPercent: number;
  discountPaise: number;
  taxRate: 0 | 5 | 12 | 18 | 28;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  totalPaise: number;
}

export interface PurchaseInvoice extends TransactionEnvelope {
  documentType: 'PURCHASE_INVOICE' | 'PURCHASE_RETURN';
  vendorBillNumber: string;
  vendorBillDate: string;
  partyName: string;
  partyGstin?: string;
  partyStateCode?: string;
  placeOfSupply: string;
  dueDate: string;
  items: PurchaseLineItem[];
  subtotalPaise: number;
  taxableAmountPaise: number;
  cgstAmountPaise: number;
  sgstAmountPaise: number;
  igstAmountPaise: number;
  totalTaxPaise: number;
  discountPaise: number;
  additionalChargesPaise: number;
  roundOffPaise: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  balanceDuePaise: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  rcmApplicable: boolean;
  notes?: string;
}

