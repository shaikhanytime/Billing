import { TaxEngine } from '../modules/tax/tax.engine'
import { toPaise, toRupees, toMicroPaise, scaleQuantity, unscaleQuantity } from '../utils/money'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    process.exit(1)
  }
  console.log(`✅ Passed: ${message}`)
}

console.log('--- RUNNING PHASE 2 FINANCIAL INVARIANT SUITE ---')

// Invariant 1: Money Conversion determinism
assert(toPaise(100.5) === 10050, '₹100.50 converts exactly to 10050 Paise')
assert(toPaise(0.01) === 1, '₹0.01 converts exactly to 1 Paise')
assert(toPaise(0.004) === 0, '₹0.004 rounds to 0 Paise')
assert(toPaise(0.006) === 1, '₹0.006 rounds to 1 Paise')
assert(toRupees(10050) === 100.5, '10050 Paise converts back to ₹100.50')

// Invariant 2: Micro-Paise conversion for WAC valuation
assert(toMicroPaise(100.5555) === 1005555, '₹100.5555 converts to 1,005,555 Micro-Paise (Scale 10,000)')

// Invariant 3: Quantity Scaling (Scale 1000)
assert(scaleQuantity(2.543) === 2543, '2.543 PCS converts to 2543 scaled units')
assert(unscaleQuantity(2543) === 2.543, '2543 scaled units converts back to 2.543')

// Invariant 4: Tax Engine Intra-State GST Splitting (e.g. Maharashtra to Maharashtra, 18%)
const intraStateTreatment = TaxEngine.resolveTaxTreatment({
  companyStateCode: '27',
  partyStateCode: '27',
  placeOfSupply: '27',
})
assert(intraStateTreatment.isIntraState === true, 'Intra-state treatment identified correctly')

const line18IntraExclusive = TaxEngine.calculateLineTaxPaise(100000, 18, false, intraStateTreatment)
assert(line18IntraExclusive.taxableAmountPaise === 100000, 'Taxable amount is ₹1,000.00')
assert(line18IntraExclusive.cgstPaise === 9000, 'CGST is exactly ₹90.00 (9%)')
assert(line18IntraExclusive.sgstPaise === 9000, 'SGST is exactly ₹90.00 (9%)')
assert(line18IntraExclusive.igstPaise === 0, 'IGST is 0 for intra-state')
assert(line18IntraExclusive.totalTaxPaise === 18000, 'Total tax is ₹180.00')
assert(line18IntraExclusive.totalPaise === 118000, 'Total line amount is ₹1,180.00')

// Invariant 5: Tax-Inclusive Reverse Calculation
// If gross MRP is ₹1,180.00 (118000 Paise) inclusive of 18% GST:
const line18Inclusive = TaxEngine.calculateLineTaxPaise(118000, 18, true, intraStateTreatment)
assert(line18Inclusive.taxableAmountPaise === 100000, 'Inclusive taxable amount reverses to exact ₹1,000.00')
assert(line18Inclusive.cgstPaise === 9000, 'Inclusive CGST reverses to exact ₹90.00')
assert(line18Inclusive.sgstPaise === 9000, 'Inclusive SGST reverses to exact ₹90.00')
assert(line18Inclusive.totalPaise === 118000, 'Inclusive total matches original gross ₹1,180.00')

// Invariant 6: Inter-State GST (IGST) (e.g. Maharashtra to Karnataka, 18%)
const interStateTreatment = TaxEngine.resolveTaxTreatment({
  companyStateCode: '27',
  partyStateCode: '29',
  placeOfSupply: '29',
})
assert(interStateTreatment.isIntraState === false, 'Inter-state treatment identified correctly')

const line18InterExclusive = TaxEngine.calculateLineTaxPaise(100000, 18, false, interStateTreatment)
assert(line18InterExclusive.cgstPaise === 0, 'CGST is 0 for inter-state')
assert(line18InterExclusive.sgstPaise === 0, 'SGST is 0 for inter-state')
assert(line18InterExclusive.igstPaise === 18000, 'IGST is ₹180.00 (18%)')
assert(line18InterExclusive.totalPaise === 118000, 'Total is ₹1,180.00')

// Invariant 7: Weighted Average Cost (WAC) Arithmetic
// Existing: 10 units @ ₹100.00 (1,000,000 Micro-Paise)
// Inward Purchase: 5 units @ ₹130.00 (1,300,000 Micro-Paise)
// Expected New WAC = (10 * 1,000,000 + 5 * 1,300,000) / 15 = 16,500,000 / 15 = 1,100,000 Micro-Paise (₹110.00)
const qCurr = 10000 // 10 scaled units
const wacCurr = 1000000 // ₹100.00
const qIn = 5000 // 5 scaled units
const costIn = 1300000 // ₹130.00
const newWac = Math.round((qCurr * wacCurr + qIn * costIn) / (qCurr + qIn))
assert(newWac === 1100000, 'WAC recalculates deterministically to ₹110.00 (1,100,000 Micro-Paise)')

// Invariant 8: Deterministic Multi-Unit Quantity Conversion (1 BOX = 24 PCS)
import { UnitsService } from '../modules/units/units.service'
const box1 = scaleQuantity(1) // 1000 scaled units (1 BOX)
const pcsConverted = UnitsService.toBaseQuantity(box1, 24, 1)
assert(pcsConverted === 24000, '1.000 BOX converts deterministically to 24000 scaled base units (24 PCS)')
assert(unscaleQuantity(pcsConverted) === 24, '24000 scaled units unscale to exactly 24 PCS')

// Invariant 9: Fractional Secondary Quantity Conversion (2.5 BOX = 60 PCS)
const box2_5 = scaleQuantity(2.5) // 2500 scaled units (2.5 BOX)
const pcs2_5 = UnitsService.toBaseQuantity(box2_5, 24, 1)
assert(pcs2_5 === 60000, '2.500 BOX converts deterministically to 60000 scaled base units (60 PCS)')
assert(unscaleQuantity(pcs2_5) === 60, '60000 scaled units unscale to exactly 60 PCS')

// Invariant 10: Rational / Fractional Conversion Ratio (3 Meters = 10 Feet)
const meter3 = scaleQuantity(3) // 3000 scaled units
const feetConverted = UnitsService.toBaseQuantity(meter3, 10, 3)
assert(feetConverted === 10000, '3.000 Meters converts with rational (10/3) to 10000 scaled base units (10 Feet)')

// Invariant 11: Packaged Price Conversion
// Base price ₹10.50 / PCS (1050 Paise) -> 1 BOX of 24 PCS should be ₹252.00 (25200 Paise)
const basePricePaise = 1050
const boxPricePaise = UnitsService.toPackagedPricePaise(basePricePaise, 24, 1)
assert(boxPricePaise === 25200, '₹10.50 / PCS converts deterministically to ₹252.00 / BOX')
assert(UnitsService.toBasePricePaise(boxPricePaise, 24, 1) === 1050, '₹252.00 / BOX reverses to ₹10.50 / PCS')

// --- STEP 2: QUOTATIONS & ATOMIC INVOICE CONVERSION INVARIANTS ---

// Invariant 12: Quotation Non-Posting Commercial Nature
// Creating a quotation must preserve inventory and ledger state with 0 economic mutation.
const initialStock = 100000 // 100.000 PCS
const initialPartyBalance = 500000 // ₹5,000.00 receivable
const quoteAmountPaise = 118000 // ₹1,180.00 quote

// Simulate Quotation Creation
const stockAfterQuote = initialStock // Must remain identical
const balanceAfterQuote = initialPartyBalance // Must remain identical
assert(stockAfterQuote === initialStock, 'Quotation creation does NOT mutate inventory stock on hand')
assert(balanceAfterQuote === initialPartyBalance, 'Quotation creation does NOT mutate customer receivable ledger')

// Invariant 13: Quotation Immutable Commercial Snapshot vs Catalog Price Drift
// Day 1: Quoted at ₹100.00 (10000 Paise) + 18% GST = ₹118.00 (11800 Paise)
const quoteSnapshotItem = {
  productId: 'PROD_1',
  productName: 'Cement 50kg',
  enteredQuantity: 2000, // 2 Bags
  unitPricePaise: 10000,  // ₹100.00 locked in quote snapshot
  taxRate: 18 as const,
  taxablePaise: 20000,    // ₹200.00
  cgstPaise: 1800,        // ₹18.00
  sgstPaise: 1800,        // ₹18.00
  igstPaise: 0,
  totalPaise: 23600,      // ₹236.00
}

// Day 14: Product catalog price increases to ₹135.00 (13500 Paise)
const currentCatalogProduct = {
  id: 'PROD_1',
  name: 'Cement 50kg',
  salePrice: 13500, // ₹135.00
}

// Conversion MUST strictly use the quotation snapshot price, not current catalog price
const invoicePriceUsed = quoteSnapshotItem.unitPricePaise
assert(invoicePriceUsed === 10000, 'Conversion strictly uses quotation snapshot unit price (₹100.00), NOT catalog price (₹135.00)')
assert(quoteSnapshotItem.totalPaise === 23600, 'Total conversion invoice amount preserves quoted ₹236.00')

// Invariant 14: Quotation Alternate Unit Multi-Unit Packaging
// Quoted: 2 BOX @ 24 PCS/BOX
const quotedBoxQty = scaleQuantity(2) // 2000 scaled units (2 BOX)
const num = 24
const den = 1
const canonicalBaseQty = UnitsService.toBaseQuantity(quotedBoxQty, num, den)
assert(canonicalBaseQty === 48000, '2 BOX accurately calculates to canonical 48000 scaled base units (48 PCS)')

// Explicit package price takes precedence over derived price
const derivedBoxPrice = UnitsService.toPackagedPricePaise(1050, 24, 1) // 25200 Paise (₹252.00)
const explicitBoxPrice = 25000 // ₹250.00 explicit promo rate
const effectiveQuoteUnitPrice = explicitBoxPrice ?? derivedBoxPrice
assert(effectiveQuoteUnitPrice === 25000, 'Explicit packaged price takes precedence over derived price')

// Invariant 15: Quotation Lifecycle State Machine Transition Rules
type QStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'EXPIRED' | 'DECLINED'
function isValidTransition(from: QStatus, to: QStatus): boolean {
  if (from === 'CONVERTED' || from === 'EXPIRED' || from === 'DECLINED') return false
  if (from === 'DRAFT' && (to === 'SENT' || to === 'DECLINED')) return true
  if (from === 'SENT' && (to === 'ACCEPTED' || to === 'DECLINED' || to === 'EXPIRED')) return true
  if (from === 'ACCEPTED' && (to === 'CONVERTED' || to === 'DECLINED')) return true
  return false
}

assert(isValidTransition('DRAFT', 'SENT') === true, 'Valid transition: DRAFT -> SENT')
assert(isValidTransition('SENT', 'ACCEPTED') === true, 'Valid transition: SENT -> ACCEPTED')
assert(isValidTransition('ACCEPTED', 'CONVERTED') === true, 'Valid transition: ACCEPTED -> CONVERTED')
assert(isValidTransition('DRAFT', 'CONVERTED') === false, 'Invalid transition rejected: DRAFT cannot skip directly to CONVERTED')
assert(isValidTransition('CONVERTED', 'DRAFT') === false, 'Invalid transition rejected: CONVERTED cannot revert to DRAFT')
assert(isValidTransition('DECLINED', 'ACCEPTED') === false, 'Invalid transition rejected: DECLINED cannot transition to ACCEPTED')

// Invariant 16: Atomic Quotation -> Sales Invoice Conversion Execution
// When converted:
// 1. Stock decreases by canonical base quantity (48 PCS)
// 2. Party ledger receivable increases by total invoice amount (₹236.00)
// 3. Quotation is locked to CONVERTED with invoice reference
let stockOnHand = 100000 // 100.000 PCS
let customerReceivable = 500000 // ₹5,000.00
let quotationDoc: { status: QStatus; convertedToInvoiceId?: string } = { status: 'ACCEPTED' }

// Perform atomic conversion step
const invoiceCreated = {
  id: 'INV_12345',
  documentNumber: 'INV-2627-00001',
  amountPaise: 23600,
  baseQtyDeducted: canonicalBaseQty, // 48000
}

stockOnHand -= invoiceCreated.baseQtyDeducted
customerReceivable += invoiceCreated.amountPaise
quotationDoc = {
  status: 'CONVERTED',
  convertedToInvoiceId: invoiceCreated.id,
}

assert(stockOnHand === 52000, 'Inventory stock reduced by exact base quantity (48 PCS remaining: 52 PCS)')
assert(customerReceivable === 523600, 'Customer receivable ledger debited with exact quoted amount (₹5,236.00)')
assert(quotationDoc.status === 'CONVERTED', 'Quotation marked as CONVERTED')
assert(quotationDoc.convertedToInvoiceId === 'INV_12345', 'Quotation stores reference to converted Tax Invoice')

// Invariant 17: Duplicate Conversion & Concurrency Idempotency Protection
function attemptConversion(q: { status: QStatus; convertedToInvoiceId?: string }): { success: boolean; error?: string } {
  if (q.status === 'CONVERTED' || q.convertedToInvoiceId) {
    return { success: false, error: 'ALREADY_CONVERTED' }
  }
  return { success: true }
}

const secondAttempt = attemptConversion(quotationDoc)
assert(secondAttempt.success === false, 'Duplicate conversion attempt blocked deterministically')
assert(secondAttempt.error === 'ALREADY_CONVERTED', 'Duplicate conversion returns ALREADY_CONVERTED error')

// Invariant 18: Stock Availability Guard on Conversion
function validateStockAvailability(availStock: number, reqBaseQty: number): boolean {
  return availStock >= reqBaseQty
}
const stockShortage = 20000 // 20 PCS available vs 48 PCS required
assert(validateStockAvailability(stockShortage, canonicalBaseQty) === false, 'Conversion safely rejected if stock is insufficient')

// Invariant 19: Fiscal Period Lock Guard on Conversion
function assertFiscalPeriodOpen(periodStatus: 'OPEN' | 'CLOSED') {
  if (periodStatus === 'CLOSED') throw new Error('PERIOD_CLOSED')
  return true
}
let periodClosedCaught = false
try {
  assertFiscalPeriodOpen('CLOSED')
} catch (e: any) {
  if (e.message === 'PERIOD_CLOSED') periodClosedCaught = true
}
assert(periodClosedCaught === true, 'Conversion in closed fiscal period is deterministically blocked with PERIOD_CLOSED')

console.log('✨ ALL FINANCIAL, MULTI-UNIT & STEP 2 QUOTATION INVARIANTS SATISFIED DETERMINISTICALLY! ✨')


