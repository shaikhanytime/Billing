import { db } from '../../config/firebase-admin'
import {
  PaymentVoucher,
  PaymentAllocation,
  AdvanceAllocation,
  PartyLedgerEntry,
  SaleInvoice,
  PurchaseInvoice,
} from '../../types/domain.types'
import { toPaise } from '../../utils/money'
import { SequenceService } from '../sequence/sequence.service'
import { PeriodService } from '../periods/period.service'
import { AuditService } from '../audit/audit.service'

export interface RecordPaymentInput {
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
  locationId?: string
  warehouseId?: string
}

export interface ApplyAdvanceInput {
  sourcePaymentId: string
  invoiceId: string
  invoiceType: 'SALE_INVOICE' | 'PURCHASE_INVOICE'
  amountPaise?: number
  amountRupees?: number
}

export class PaymentsService {
  /**
   * Records a standalone Payment In (Customer Receipt) or Payment Out (Supplier Disbursement)
   * with atomic invoice allocation, party ledger credit/debit, and advance computation.
   */
  static async recordPayment(
    orgId: string,
    data: RecordPaymentInput,
    actor: { uid: string; email?: string }
  ): Promise<PaymentVoucher> {
    const now = new Date().toISOString()
    const txnDate = data.transactionDate || now.slice(0, 10)
    const periodId = await PeriodService.assertPeriodOpen(orgId, txnDate)
    const locId = data.locationId || 'default_loc'
    const whId = data.warehouseId || 'default_wh'

    const paymentPaise =
      data.paymentAmountPaise !== undefined
        ? data.paymentAmountPaise
        : toPaise(data.paymentAmountRupees || 0)

    const discountPaise =
      data.discountPaise !== undefined
        ? data.discountPaise
        : toPaise(data.discountRupees || 0)

    const totalSettlementPaise = paymentPaise + discountPaise

    if (totalSettlementPaise <= 0) {
      throw new Error('Payment or discount amount must be greater than zero.')
    }

    if (paymentPaise < 0 || discountPaise < 0) {
      throw new Error('Amounts cannot be negative.')
    }

    const paymentRef = db.collection(`organizations/${orgId}/payments`).doc()
    const partyRef = db.doc(`organizations/${orgId}/parties/${data.partyId}`)

    let paymentDoc: PaymentVoucher

    await db.runTransaction(async (txn) => {
      // 1. Verify party exists
      const partySnap = await txn.get(partyRef)
      if (!partySnap.exists) throw new Error('Party not found.')
      const partyData = partySnap.data() as any
      const currentPartyBalance = (partyData.currentBalance || 0) as number

      // 2. Allocate Document Sequence
      const prefix = data.type === 'PAYMENT_IN' ? 'PMT-IN-' : 'PMT-OUT-'
      const docNumber = await SequenceService.allocateInTransaction(
        txn,
        orgId,
        periodId,
        data.type,
        prefix
      )

      const allocationRecords: PaymentAllocation[] = []
      const voucherAllocations: PaymentVoucher['allocations'] = []

      let remainingSettlement = totalSettlementPaise
      let remainingDiscount = discountPaise
      let remainingPayment = paymentPaise

      // 3. Process Allocation Strategy
      if (data.autoAllocateFIFO) {
        // --- FIFO Auto-Allocation Mode ---
        const invoiceCollection =
          data.type === 'PAYMENT_IN' ? 'salesInvoices' : 'purchases'
        const invoiceType =
          data.type === 'PAYMENT_IN' ? 'SALE_INVOICE' : 'PURCHASE_INVOICE'

        const openInvoicesQuery = await db
          .collection(`organizations/${orgId}/${invoiceCollection}`)
          .where('partyId', '==', data.partyId)
          .where('status', '==', 'POSTED')
          .get()

        const eligibleInvoices = openInvoicesQuery.docs
          .map((d) => d.data() as SaleInvoice | PurchaseInvoice)
          .filter((inv) => (inv.balanceDuePaise || 0) > 0)
          .sort((a, b) => {
            // Deterministic Tie-Breaker: invoiceDate ASC, documentNumber ASC, transactionId ASC
            const dCompare = (a.transactionDate || '').localeCompare(b.transactionDate || '')
            if (dCompare !== 0) return dCompare
            const numCompare = (a.documentNumber || '').localeCompare(b.documentNumber || '')
            if (numCompare !== 0) return numCompare
            return (a.transactionId || '').localeCompare(b.transactionId || '')
          })

        for (const inv of eligibleInvoices) {
          if (remainingSettlement === 0) break

          const invRef = db.collection(`organizations/${orgId}/${invoiceCollection}`).doc(inv.transactionId)
          const invSnap = await txn.get(invRef)
          if (!invSnap.exists) continue
          const currentInv = invSnap.data() as SaleInvoice | PurchaseInvoice
          const curDue = currentInv.balanceDuePaise || 0
          if (curDue <= 0) continue

          const invSettlement = Math.min(curDue, remainingSettlement)
          const discAlloc = Math.min(invSettlement, remainingDiscount)
          const payAlloc = invSettlement - discAlloc

          remainingSettlement -= invSettlement
          remainingDiscount -= discAlloc
          remainingPayment -= payAlloc

          const newBalanceDue = curDue - invSettlement
          const newPaidAmount = (currentInv.paidAmountPaise || 0) + invSettlement
          const newStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
            newBalanceDue === 0 ? 'PAID' : 'PARTIAL'

          txn.update(invRef, {
            balanceDuePaise: newBalanceDue,
            paidAmountPaise: newPaidAmount,
            paymentStatus: newStatus,
            updatedAt: now,
          })

          const allocId = db.collection(`organizations/${orgId}/paymentAllocations`).doc().id
          const allocEntry: PaymentAllocation = {
            id: allocId,
            orgId,
            paymentId: paymentRef.id,
            invoiceId: inv.transactionId,
            invoiceType,
            invoiceNumber: inv.documentNumber,
            paymentAllocatedPaise: payAlloc,
            discountAllocatedPaise: discAlloc,
            settlementAllocatedPaise: invSettlement,
            allocatedAmount: invSettlement,
            allocatedAt: now,
          }
          allocationRecords.push(allocEntry)

          voucherAllocations.push({
            allocationId: allocId,
            invoiceId: inv.transactionId,
            invoiceNumber: inv.documentNumber,
            invoiceType,
            paymentAllocatedPaise: payAlloc,
            discountAllocatedPaise: discAlloc,
            settlementAllocatedPaise: invSettlement,
            allocatedAmount: invSettlement,
          })
        }

        if (remainingDiscount > 0) {
          throw new Error('INVALID_DISCOUNT_EXCEEDS_SETTLEMENT: Total settlement discount exceeds eligible unpaid invoice balances.')
        }
      } else if (data.allocations && data.allocations.length > 0) {
        // --- Explicit Allocation Mode ---
        let totalExplicitPaymentAlloc = 0
        let totalExplicitDiscAlloc = 0

        for (const reqAlloc of data.allocations) {
          const invType =
            reqAlloc.invoiceType ||
            (data.type === 'PAYMENT_IN' ? 'SALE_INVOICE' : 'PURCHASE_INVOICE')
          const colName = invType === 'SALE_INVOICE' ? 'salesInvoices' : 'purchases'

          const invRef = db.collection(`organizations/${orgId}/${colName}`).doc(reqAlloc.invoiceId)
          const invSnap = await txn.get(invRef)
          if (!invSnap.exists) {
            throw new Error(`Invoice ${reqAlloc.invoiceId} not found.`)
          }
          const invData = invSnap.data() as SaleInvoice | PurchaseInvoice
          if (invData.organizationId !== orgId || invData.partyId !== data.partyId) {
            throw new Error(`Invoice ${invData.documentNumber} does not belong to this party.`)
          }

          const reqPaymentAlloc =
            reqAlloc.paymentAllocatedPaise !== undefined
              ? reqAlloc.paymentAllocatedPaise
              : toPaise(reqAlloc.allocatedAmountRupees || 0)
          const reqDiscAlloc = reqAlloc.discountAllocatedPaise || 0
          const reqSettlement = reqPaymentAlloc + reqDiscAlloc

          const curDue = invData.balanceDuePaise || 0
          if (reqSettlement > curDue) {
            throw new Error(
              `Allocation of ${reqSettlement} Paise exceeds balance due of ${curDue} Paise on invoice ${invData.documentNumber}.`
            )
          }

          totalExplicitPaymentAlloc += reqPaymentAlloc
          totalExplicitDiscAlloc += reqDiscAlloc

          const newBalanceDue = curDue - reqSettlement
          const newPaidAmount = (invData.paidAmountPaise || 0) + reqSettlement
          const newStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
            newBalanceDue === 0 ? 'PAID' : 'PARTIAL'

          txn.update(invRef, {
            balanceDuePaise: newBalanceDue,
            paidAmountPaise: newPaidAmount,
            paymentStatus: newStatus,
            updatedAt: now,
          })

          const allocId = db.collection(`organizations/${orgId}/paymentAllocations`).doc().id
          const allocEntry: PaymentAllocation = {
            id: allocId,
            orgId,
            paymentId: paymentRef.id,
            invoiceId: invData.transactionId,
            invoiceType: invType,
            invoiceNumber: invData.documentNumber,
            paymentAllocatedPaise: reqPaymentAlloc,
            discountAllocatedPaise: reqDiscAlloc,
            settlementAllocatedPaise: reqSettlement,
            allocatedAmount: reqSettlement,
            allocatedAt: now,
          }
          allocationRecords.push(allocEntry)

          voucherAllocations.push({
            allocationId: allocId,
            invoiceId: invData.transactionId,
            invoiceNumber: invData.documentNumber,
            invoiceType: invType,
            paymentAllocatedPaise: reqPaymentAlloc,
            discountAllocatedPaise: reqDiscAlloc,
            settlementAllocatedPaise: reqSettlement,
            allocatedAmount: reqSettlement,
          })
        }

        if (totalExplicitPaymentAlloc > paymentPaise) {
          throw new Error('Total allocated payment funds cannot exceed payment amount.')
        }

        if (discountPaise > 0 && totalExplicitDiscAlloc !== discountPaise) {
          throw new Error('INVALID_DISCOUNT_ALLOCATION: Settlement discount must be fully allocated to selected invoices.')
        }

        remainingPayment = paymentPaise - totalExplicitPaymentAlloc
      } else {
        // --- No Invoice Allocations (Pure Advance) ---
        if (discountPaise > 0) {
          throw new Error('INVALID_DISCOUNT_ALLOCATION: Settlement discount cannot be granted without allocating to an invoice.')
        }
        remainingPayment = paymentPaise
      }

      // Physical advance remaining
      const unallocatedAdvancePaise = remainingPayment

      // 4. Construct PaymentVoucher Document
      paymentDoc = {
        transactionId: paymentRef.id,
        organizationId: orgId,
        financialPeriodId: periodId,
        documentType: data.type,
        documentNumber: docNumber,
        transactionDate: txnDate,
        postingDate: now,
        status: 'POSTED',
        locationId: locId,
        warehouseId: whId,
        partyId: data.partyId,
        partyName: data.partyName,
        partyType: data.partyType,
        paymentAmountPaise: paymentPaise,
        discountPaise,
        settlementAmountPaise: totalSettlementPaise,
        unallocatedPaymentAmountPaise: unallocatedAdvancePaise,
        totalAmount: paymentPaise,
        discountAmount: discountPaise,
        unallocatedAmount: unallocatedAdvancePaise,
        paymentMode: data.paymentMode,
        bankAccountId: data.bankAccountId,
        referenceNumber: data.referenceNumber,
        allocations: voucherAllocations,
        notes: data.notes,
        createdBy: actor.uid,
        createdAt: now,
        updatedAt: now,
      }

      txn.set(paymentRef, paymentDoc)

      // 5. Write PaymentAllocation records
      for (const alloc of allocationRecords) {
        const allocRef = db.doc(`organizations/${orgId}/paymentAllocations/${alloc.id}`)
        txn.set(allocRef, alloc)
      }

      // 6. Post Authoritative Single Entry to Party Ledger
      const ledgerRef = db.collection(`organizations/${orgId}/partyLedger`).doc()
      let debit = 0
      let credit = 0
      let newPartyBalance = currentPartyBalance

      if (data.type === 'PAYMENT_IN') {
        // Customer receipt -> Credit party (reduces receivable)
        credit = totalSettlementPaise
        newPartyBalance -= totalSettlementPaise
      } else {
        // Supplier disbursement -> Debit party (reduces payable)
        debit = totalSettlementPaise
        newPartyBalance += totalSettlementPaise
      }

      const discText = discountPaise > 0 ? `, Discount: ₹${(discountPaise / 100).toFixed(2)}` : ''
      const refText = data.referenceNumber ? ` Ref: ${data.referenceNumber}` : ''

      const ledgerEntry: PartyLedgerEntry = {
        id: ledgerRef.id,
        orgId,
        partyId: data.partyId,
        transactionId: paymentRef.id,
        documentType: data.type,
        documentNumber: docNumber,
        date: txnDate,
        debit,
        credit,
        balanceSnapshot: newPartyBalance,
        description: `Payment ${data.type === 'PAYMENT_IN' ? 'Received' : 'Made'} via ${data.paymentMode}${refText}${discText}`,
        createdBy: actor.uid,
        createdAt: now,
      }

      txn.set(ledgerRef, ledgerEntry)
      txn.update(partyRef, { currentBalance: newPartyBalance, updatedAt: now })

      // 7. Atomic Audit Log
      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'POST',
        entityType: data.type,
        entityId: paymentRef.id,
        entityNumber: docNumber,
        diff: {
          after: {
            paymentAmountPaise: paymentPaise,
            discountPaise,
            settlementAmountPaise: totalSettlementPaise,
            unallocatedPaymentAmountPaise: unallocatedAdvancePaise,
            allocationsCount: voucherAllocations.length,
          },
        },
      })
    })

    return paymentDoc!
  }

  /**
   * Reverses a payment voucher atomically.
   * Restores invoice balances, recalculates status, reverses party ledger entry,
   * and enforces ADVANCE_ALREADY_APPLIED dependency protection.
   */
  static async reversePayment(
    orgId: string,
    paymentId: string,
    reason: string,
    actor: { uid: string; email?: string }
  ): Promise<PaymentVoucher> {
    const now = new Date().toISOString()
    const paymentRef = db.doc(`organizations/${orgId}/payments/${paymentId}`)

    let updatedVoucher: PaymentVoucher

    await db.runTransaction(async (txn) => {
      const snap = await txn.get(paymentRef)
      if (!snap.exists) throw new Error('Payment voucher not found.')
      const voucher = snap.data() as PaymentVoucher

      if (voucher.status === 'REVERSED') {
        throw new Error('ALREADY_REVERSED: Payment voucher is already reversed.')
      }

      await PeriodService.assertPeriodOpen(orgId, now.slice(0, 10))

      // Check dependent active advance allocations
      const advSnap = await db
        .collection(`organizations/${orgId}/advanceAllocations`)
        .where('sourcePaymentId', '==', paymentId)
        .where('status', '==', 'APPLIED')
        .get()

      if (!advSnap.empty) {
        throw new Error(
          'ADVANCE_ALREADY_APPLIED: Cannot reverse payment voucher because its advance has active downstream allocations. Reverse downstream advance allocations first.'
        )
      }

      const partyRef = db.doc(`organizations/${orgId}/parties/${voucher.partyId}`)
      const partySnap = await txn.get(partyRef)
      if (!partySnap.exists) throw new Error('Party not found.')
      const currentPartyBal = ((partySnap.data() as any).currentBalance || 0) as number

      // Restore each allocated invoice
      const allocSnap = await db
        .collection(`organizations/${orgId}/paymentAllocations`)
        .where('paymentId', '==', paymentId)
        .get()

      for (const doc of allocSnap.docs) {
        const alloc = doc.data() as PaymentAllocation
        const colName = alloc.invoiceType === 'SALE_INVOICE' ? 'salesInvoices' : 'purchases'
        const invRef = db.doc(`organizations/${orgId}/${colName}/${alloc.invoiceId}`)
        const invSnap = await txn.get(invRef)

        if (invSnap.exists) {
          const inv = invSnap.data() as SaleInvoice | PurchaseInvoice
          const curDue = inv.balanceDuePaise || 0
          const curPaid = inv.paidAmountPaise || 0
          const totalAmt = inv.totalAmountPaise || 0

          const restoredDue = curDue + alloc.settlementAllocatedPaise
          const restoredPaid = Math.max(0, curPaid - alloc.settlementAllocatedPaise)
          const newStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
            restoredDue === totalAmt ? 'UNPAID' : restoredDue === 0 ? 'PAID' : 'PARTIAL'

          txn.update(invRef, {
            balanceDuePaise: restoredDue,
            paidAmountPaise: restoredPaid,
            paymentStatus: newStatus,
            updatedAt: now,
          })
        }

        // Delete or mark allocation as reversed
        txn.delete(doc.ref)
      }

      // Reverse Party Ledger
      const totalSettlement = voucher.settlementAmountPaise || (voucher.paymentAmountPaise || voucher.totalAmount || 0) + (voucher.discountPaise || 0)
      let debit = 0
      let credit = 0
      let newPartyBal = currentPartyBal

      if (voucher.documentType === 'PAYMENT_IN') {
        // Reverse customer receipt -> Debit party (restores receivable)
        debit = totalSettlement
        newPartyBal += totalSettlement
      } else {
        // Reverse supplier disbursement -> Credit party (restores payable)
        credit = totalSettlement
        newPartyBal -= totalSettlement
      }

      const ledgerRef = db.collection(`organizations/${orgId}/partyLedger`).doc()
      const ledgerEntry: PartyLedgerEntry = {
        id: ledgerRef.id,
        orgId,
        partyId: voucher.partyId,
        transactionId: voucher.transactionId,
        documentType: voucher.documentType,
        documentNumber: voucher.documentNumber,
        date: now.slice(0, 10),
        debit,
        credit,
        balanceSnapshot: newPartyBal,
        description: `Reversal of Payment #${voucher.documentNumber}: ${reason || 'Cancelled'}`,
        createdBy: actor.uid,
        createdAt: now,
      }

      txn.set(ledgerRef, ledgerEntry)
      txn.update(partyRef, { currentBalance: newPartyBal, updatedAt: now })

      // Mark voucher as REVERSED
      updatedVoucher = {
        ...voucher,
        status: 'REVERSED',
        reversedAt: now,
        reversedBy: actor.uid,
        reversalReason: reason,
        updatedAt: now,
      }

      txn.set(paymentRef, updatedVoucher)

      // Audit Log
      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'REVERSE',
        entityType: voucher.documentType,
        entityId: voucher.transactionId,
        entityNumber: voucher.documentNumber,
        diff: {
          after: { status: 'REVERSED', reason },
        },
      })
    })

    return updatedVoucher!
  }

  /**
   * Applies an available unconsumed advance from a PaymentVoucher to an open invoice.
   * Zero Party Ledger duplication (per Non-Duplication Principle).
   */
  static async applyAdvance(
    orgId: string,
    input: ApplyAdvanceInput,
    actor: { uid: string; email?: string }
  ): Promise<AdvanceAllocation> {
    const now = new Date().toISOString()
    const paymentRef = db.doc(`organizations/${orgId}/payments/${input.sourcePaymentId}`)
    const colName = input.invoiceType === 'SALE_INVOICE' ? 'salesInvoices' : 'purchases'
    const invRef = db.doc(`organizations/${orgId}/${colName}/${input.invoiceId}`)

    let createdAdvanceAlloc: AdvanceAllocation

    await db.runTransaction(async (txn) => {
      const paySnap = await txn.get(paymentRef)
      if (!paySnap.exists) throw new Error('Source payment voucher not found.')
      const voucher = paySnap.data() as PaymentVoucher

      if (voucher.status !== 'POSTED') {
        throw new Error('Cannot apply advance from a reversed or inactive payment voucher.')
      }

      const origAdvance = voucher.unallocatedPaymentAmountPaise || voucher.unallocatedAmount || 0
      if (origAdvance <= 0) {
        throw new Error('Source payment voucher has no original advance balance.')
      }

      // Calculate active allocations
      const activeAllocsSnap = await db
        .collection(`organizations/${orgId}/advanceAllocations`)
        .where('sourcePaymentId', '==', input.sourcePaymentId)
        .where('status', '==', 'APPLIED')
        .get()

      const activeAllocSum = activeAllocsSnap.docs.reduce(
        (sum, d) => sum + ((d.data() as AdvanceAllocation).amountPaise || 0),
        0
      )

      const availableAdvance = origAdvance - activeAllocSum
      if (availableAdvance <= 0) {
        throw new Error('No available unallocated advance remaining on this payment voucher.')
      }

      const invSnap = await txn.get(invRef)
      if (!invSnap.exists) throw new Error('Target invoice not found.')
      const inv = invSnap.data() as SaleInvoice | PurchaseInvoice

      if (inv.partyId !== voucher.partyId) {
        throw new Error('Invoice and advance voucher must belong to the same party.')
      }

      const curDue = inv.balanceDuePaise || 0
      if (curDue <= 0) {
        throw new Error('Target invoice is already fully settled.')
      }

      const reqAmount =
        input.amountPaise !== undefined ? input.amountPaise : toPaise(input.amountRupees || 0)
      const applyAmount = reqAmount > 0 ? Math.min(reqAmount, availableAdvance, curDue) : Math.min(availableAdvance, curDue)

      if (applyAmount <= 0) {
        throw new Error('Advance apply amount must be greater than zero.')
      }

      // Update Target Invoice
      const newDue = curDue - applyAmount
      const newPaid = (inv.paidAmountPaise || 0) + applyAmount
      const newStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = newDue === 0 ? 'PAID' : 'PARTIAL'

      txn.update(invRef, {
        balanceDuePaise: newDue,
        paidAmountPaise: newPaid,
        paymentStatus: newStatus,
        updatedAt: now,
      })

      // Create AdvanceAllocation document
      const advAllocRef = db.collection(`organizations/${orgId}/advanceAllocations`).doc()
      createdAdvanceAlloc = {
        id: advAllocRef.id,
        orgId,
        sourcePaymentId: voucher.transactionId,
        sourcePaymentDocumentNumber: voucher.documentNumber,
        invoiceId: inv.transactionId,
        invoiceNumber: inv.documentNumber,
        invoiceType: input.invoiceType,
        amountPaise: applyAmount,
        status: 'APPLIED',
        appliedAt: now,
      }

      txn.set(advAllocRef, createdAdvanceAlloc)

      // Zero Party Ledger entry (already credited on initial payment receipt)

      // Audit Log
      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'UPDATE',
        entityType: voucher.documentType,
        entityId: voucher.transactionId,
        entityNumber: voucher.documentNumber,
        diff: {
          after: {
            advanceAppliedToInvoice: inv.documentNumber,
            amountPaise: applyAmount,
          },
        },
      })
    })

    return createdAdvanceAlloc!
  }

  /**
   * Reverses an individual AdvanceAllocation and restores available advance for reuse.
   */
  static async reverseAdvanceAllocation(
    orgId: string,
    allocationId: string,
    reason: string,
    actor: { uid: string; email?: string }
  ): Promise<AdvanceAllocation> {
    const now = new Date().toISOString()
    const allocRef = db.doc(`organizations/${orgId}/advanceAllocations/${allocationId}`)

    let updatedAlloc: AdvanceAllocation

    await db.runTransaction(async (txn) => {
      const snap = await txn.get(allocRef)
      if (!snap.exists) throw new Error('Advance allocation not found.')
      const alloc = snap.data() as AdvanceAllocation

      if (alloc.status === 'REVERSED') {
        throw new Error('Advance allocation is already reversed.')
      }

      const colName = alloc.invoiceType === 'SALE_INVOICE' ? 'salesInvoices' : 'purchases'
      const invRef = db.doc(`organizations/${orgId}/${colName}/${alloc.invoiceId}`)
      const invSnap = await txn.get(invRef)

      if (invSnap.exists) {
        const inv = invSnap.data() as SaleInvoice | PurchaseInvoice
        const curDue = inv.balanceDuePaise || 0
        const curPaid = inv.paidAmountPaise || 0
        const totalAmt = inv.totalAmountPaise || 0

        const newDue = curDue + alloc.amountPaise
        const newPaid = Math.max(0, curPaid - alloc.amountPaise)
        const newStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
          newDue === totalAmt ? 'UNPAID' : newDue === 0 ? 'PAID' : 'PARTIAL'

        txn.update(invRef, {
          balanceDuePaise: newDue,
          paidAmountPaise: newPaid,
          paymentStatus: newStatus,
          updatedAt: now,
        })
      }

      updatedAlloc = {
        ...alloc,
        status: 'REVERSED',
        reversedAt: now,
        reversedBy: actor.uid,
        reversalReason: reason,
      }

      txn.set(allocRef, updatedAlloc)

      // Audit Log
      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'UPDATE',
        entityType: 'PAYMENT_IN',
        entityId: alloc.sourcePaymentId,
        diff: {
          after: {
            advanceAllocationReversed: alloc.id,
            restoredInvoice: alloc.invoiceNumber,
            amountPaise: alloc.amountPaise,
          },
        },
      })
    })

    return updatedAlloc!
  }

  /**
   * Fetches payment vouchers with filters.
   */
  static async getPayments(
    orgId: string,
    options?: {
      type?: 'PAYMENT_IN' | 'PAYMENT_OUT'
      partyId?: string
      paymentMode?: string
      status?: string
      startDate?: string
      endDate?: string
      limit?: number
    }
  ): Promise<PaymentVoucher[]> {
    let query: FirebaseFirestore.Query = db.collection(`organizations/${orgId}/payments`)

    if (options?.type) {
      query = query.where('documentType', '==', options.type)
    }
    if (options?.partyId) {
      query = query.where('partyId', '==', options.partyId)
    }
    if (options?.status) {
      query = query.where('status', '==', options.status)
    }

    query = query.orderBy('transactionDate', 'desc')

    const snap = await query.limit(options?.limit || 100).get()
    let payments = snap.docs.map((d) => d.data() as PaymentVoucher)

    if (options?.paymentMode) {
      payments = payments.filter((p) => p.paymentMode === options.paymentMode)
    }
    if (options?.startDate) {
      payments = payments.filter((p) => p.transactionDate >= options.startDate!)
    }
    if (options?.endDate) {
      payments = payments.filter((p) => p.transactionDate <= options.endDate!)
    }

    return payments
  }

  /**
   * Fetches single payment voucher with complete breakdown.
   */
  static async getPaymentById(orgId: string, id: string): Promise<PaymentVoucher | null> {
    const snap = await db.doc(`organizations/${orgId}/payments/${id}`).get()
    if (!snap.exists) return null
    return snap.data() as PaymentVoucher
  }

  /**
   * Fetches eligible open unpaid/partially-paid invoices for a party.
   */
  static async getEligibleInvoices(
    orgId: string,
    partyId: string,
    type: 'CUSTOMER' | 'SUPPLIER'
  ): Promise<{
    transactionId: string
    documentNumber: string
    transactionDate: string
    dueDate?: string
    totalAmountPaise: number
    paidAmountPaise: number
    balanceDuePaise: number
    paymentStatus: string
  }[]> {
    const colName = type === 'CUSTOMER' ? 'salesInvoices' : 'purchases'
    const snap = await db
      .collection(`organizations/${orgId}/${colName}`)
      .where('partyId', '==', partyId)
      .where('status', '==', 'POSTED')
      .get()

    return snap.docs
      .map((d) => d.data() as SaleInvoice | PurchaseInvoice)
      .filter((inv) => (inv.balanceDuePaise || 0) > 0)
      .map((inv) => ({
        transactionId: inv.transactionId,
        documentNumber: inv.documentNumber,
        transactionDate: inv.transactionDate,
        dueDate: inv.dueDate,
        totalAmountPaise: inv.totalAmountPaise || 0,
        paidAmountPaise: inv.paidAmountPaise || 0,
        balanceDuePaise: inv.balanceDuePaise || 0,
        paymentStatus: inv.paymentStatus,
      }))
      .sort((a, b) => (a.transactionDate || '').localeCompare(b.transactionDate || ''))
  }

  /**
   * Fetches available unconsumed advances for a party.
   */
  static async getAvailableAdvances(
    orgId: string,
    partyId: string
  ): Promise<{
    paymentId: string
    documentNumber: string
    transactionDate: string
    originalAdvancePaise: number
    appliedAdvancePaise: number
    availableAdvancePaise: number
  }[]> {
    const snap = await db
      .collection(`organizations/${orgId}/payments`)
      .where('partyId', '==', partyId)
      .where('status', '==', 'POSTED')
      .get()

    const vouchers = snap.docs
      .map((d) => d.data() as PaymentVoucher)
      .filter((v) => (v.unallocatedPaymentAmountPaise || v.unallocatedAmount || 0) > 0)

    const results = []

    for (const v of vouchers) {
      const origAdv = v.unallocatedPaymentAmountPaise || v.unallocatedAmount || 0
      const advSnap = await db
        .collection(`organizations/${orgId}/advanceAllocations`)
        .where('sourcePaymentId', '==', v.transactionId)
        .where('status', '==', 'APPLIED')
        .get()

      const appliedSum = advSnap.docs.reduce(
        (sum, d) => sum + ((d.data() as AdvanceAllocation).amountPaise || 0),
        0
      )
      const avail = origAdv - appliedSum

      if (avail > 0) {
        results.push({
          paymentId: v.transactionId,
          documentNumber: v.documentNumber,
          transactionDate: v.transactionDate,
          originalAdvancePaise: origAdv,
          appliedAdvancePaise: appliedSum,
          availableAdvancePaise: avail,
        })
      }
    }

    return results
  }
}
