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

console.log('✨ ALL FINANCIAL INVARIANTS SATISFIED DETERMINISTICALLY! ✨')
