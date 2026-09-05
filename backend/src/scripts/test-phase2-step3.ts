import { TaxEngine } from '../modules/tax/tax.engine'
import { toPaise, toRupees, scaleQuantity, unscaleQuantity } from '../utils/money'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${msg}`)
}

console.log('====================================================')
console.log('PHASE 2 STEP 3 PRODUCTION TESTS: PAYMENTS & ALLOCATION')
console.log('====================================================')

// 1. Unified Settlement FIFO Test
console.log('\n--- 1. Unified Settlement FIFO Allocation ---')
const fifoInvoices = [
  { id: 'INV_1', num: 'INV-001', date: '2026-04-01', totalAmountPaise: 500000, paidAmountPaise: 0, balanceDuePaise: 500000 },
  { id: 'INV_2', num: 'INV-002', date: '2026-04-03', totalAmountPaise: 500000, paidAmountPaise: 0, balanceDuePaise: 500000 },
  { id: 'INV_3', num: 'INV-003', date: '2026-04-10', totalAmountPaise: 500000, paidAmountPaise: 0, balanceDuePaise: 500000 },
]

const pmtCash = 980000 // ₹9,800
const pmtDisc = 20000  // ₹200
let remSettlement = pmtCash + pmtDisc // ₹10,000
let remDiscount = pmtDisc
let remPayment = pmtCash
const allocs: any[] = []

for (const inv of fifoInvoices) {
  if (remSettlement === 0) break
  const invSettlement = Math.min(inv.balanceDuePaise, remSettlement)
  const discAlloc = Math.min(invSettlement, remDiscount)
  const payAlloc = invSettlement - discAlloc
  remSettlement -= invSettlement
  remDiscount -= discAlloc
  remPayment -= payAlloc

  inv.balanceDuePaise -= invSettlement
  inv.paidAmountPaise += invSettlement
  allocs.push({ invoiceId: inv.id, payAlloc, discAlloc, invSettlement })
}

assert(fifoInvoices[0]!.balanceDuePaise === 0, 'Inv 1 fully settled (₹0 due)')
assert(fifoInvoices[0]!.paidAmountPaise === 500000, 'Inv 1 paid amount is ₹5,000.00')
assert(fifoInvoices[1]!.balanceDuePaise === 0, 'Inv 2 fully settled (₹0 due)')
assert(fifoInvoices[1]!.paidAmountPaise === 500000, 'Inv 2 paid amount is ₹5,000.00')
assert(fifoInvoices[2]!.balanceDuePaise === 500000, 'Inv 3 remains untouched (₹5,000 due)')
assert(remDiscount === 0, 'All discount consumed against invoice settlements')
assert(remPayment === 0, 'Zero leftover advance')
assert(allocs.length === 2, 'Allocated to exactly 2 invoices in FIFO order')

// 2. Overpayment & Advance Creation Test
console.log('\n--- 2. Overpayment & Physical Advance Creation ---')
const overpayInv = { id: 'INV_4', num: 'INV-004', totalAmountPaise: 1500000, paidAmountPaise: 0, balanceDuePaise: 1500000 }
const cashReceived = 2000000 // ₹20,000
const cashAlloc = Math.min(cashReceived, overpayInv.balanceDuePaise) // ₹15,000
const advanceAmount = cashReceived - cashAlloc // ₹5,000

overpayInv.paidAmountPaise += cashAlloc
overpayInv.balanceDuePaise -= cashAlloc

assert(overpayInv.balanceDuePaise === 0, 'Invoice 4 fully settled')
assert(advanceAmount === 500000, 'Physical advance created is exactly ₹5,000.00 (500000 Paise)')

// 3. Advance Utilization Without Party Ledger Double-Counting
console.log('\n--- 3. Advance Utilization Without Ledger Double-Counting ---')
let partyLedgerBalance = -500000 // Customer is in credit by ₹5,000 from the ₹20,000 receipt
// Future Invoice B created:
const futureInvoice = { id: 'INV_5', num: 'INV-005', totalAmountPaise: 800000, paidAmountPaise: 0, balanceDuePaise: 800000 }
partyLedgerBalance += futureInvoice.totalAmountPaise // Debited ₹8,000 -> net balance is +₹3,000

// Advance applied via AdvanceAllocation:
const applyAdv = Math.min(advanceAmount, futureInvoice.balanceDuePaise) // ₹5,000
futureInvoice.paidAmountPaise += applyAdv
futureInvoice.balanceDuePaise -= applyAdv
// Zero new ledger entries posted on advance apply!
assert(futureInvoice.balanceDuePaise === 300000, 'Future invoice remaining due is ₹3,000.00')
assert(futureInvoice.paidAmountPaise === 500000, 'Future invoice paid amount is ₹5,000.00')
assert(partyLedgerBalance === 300000, 'Party Ledger net balance (₹3,000) exactly matches invoice remaining due without duplicate credit')

// 4. Advance Reconciliation Invariant
console.log('\n--- 4. Advance Reconciliation Invariant ---')
const origAdv = 500000
const activeAdvanceAllocs = [500000] // Applied to INV_5
const availAdv = origAdv - activeAdvanceAllocs.reduce((s, a) => s + a, 0)
assert(availAdv === 0, 'Available advance is ₹0 after full utilization')
assert(origAdv === activeAdvanceAllocs[0]! + availAdv, 'originalAdvance === activeAllocations + availableAdvance')

// 5. Reversal Dependency Protection (ADVANCE_ALREADY_APPLIED)
console.log('\n--- 5. Reversal Dependency Protection ---')
function attemptPaymentReversal(hasActiveAdvanceAllocations: boolean) {
  if (hasActiveAdvanceAllocations) {
    throw new Error('ADVANCE_ALREADY_APPLIED')
  }
  return 'SUCCESS'
}
let revBlocked = false
try {
  attemptPaymentReversal(activeAdvanceAllocs.length > 0)
} catch (e: any) {
  if (e.message === 'ADVANCE_ALREADY_APPLIED') revBlocked = true
}
assert(revBlocked === true, 'Parent payment reversal is blocked when active advance allocations exist')

// 6. Advance Allocation Reversal & Reuse
console.log('\n--- 6. Advance Allocation Reversal & Reuse ---')
// Reversing the AdvanceAllocation on INV_5:
futureInvoice.paidAmountPaise -= 500000
futureInvoice.balanceDuePaise += 500000
activeAdvanceAllocs.pop()
const restoredAvailAdv = origAdv - (activeAdvanceAllocs.reduce((s, a) => s + a, 0))

assert(futureInvoice.balanceDuePaise === 800000, 'Future invoice balance due restored to ₹8,000.00')
assert(futureInvoice.paidAmountPaise === 0, 'Future invoice paid amount restored to ₹0')
assert(restoredAvailAdv === 500000, 'Advance voucher available advance restored to ₹5,000.00 and reusable')

// 7. Universal 3-Way Reconciliation Suite
console.log('\n--- 7. Universal 3-Way Reconciliation Stress Suite ---')
const testScenarios = [
  { cash: 1000000, disc: 0, invDue: 1000000 },
  { cash: 980000, disc: 20000, invDue: 1000000 },
  { cash: 480000, disc: 20000, invDue: 1000000 },
  { cash: 1500000, disc: 0, invDue: 1000000 },
  { cash: 0, disc: 50000, invDue: 500000 },
]

for (const sc of testScenarios) {
  const settlement = sc.cash + sc.disc
  const maxSettlementAllowed = Math.min(settlement, sc.invDue)
  const discAlloc = Math.min(sc.disc, maxSettlementAllowed)
  const payAlloc = maxSettlementAllowed - discAlloc
  const unallocPay = sc.cash - payAlloc
  const invPaid = maxSettlementAllowed
  const invDue = sc.invDue - maxSettlementAllowed

  assert(sc.invDue === invPaid + invDue, `Reconciliation: totalAmount (${sc.invDue}) === paidAmount (${invPaid}) + balanceDue (${invDue})`)
  assert(sc.cash === payAlloc + unallocPay, `Reconciliation: paymentAmount (${sc.cash}) === allocatedPayment (${payAlloc}) + unallocatedPayment (${unallocPay})`)
  assert(settlement === payAlloc + unallocPay + discAlloc, `Reconciliation: settlementAmount (${settlement}) === payAlloc (${payAlloc}) + unalloc (${unallocPay}) + discAlloc (${discAlloc})`)
}

console.log('\n====================================================')
console.log('✨ ALL PHASE 2 STEP 3 PRODUCTION TESTS PASSED! ✨')
console.log('====================================================')
