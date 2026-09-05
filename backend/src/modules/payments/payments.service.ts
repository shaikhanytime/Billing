import { db } from '../../config/firebase-admin'
import { PaymentVoucher, PaymentAllocation, PartyLedgerEntry } from '../../types/domain.types'
import { toPaise } from '../../utils/money'
import { SequenceService } from '../sequence/sequence.service'
import { PeriodService } from '../periods/period.service'
import { AuditService } from '../audit/audit.service'

export class PaymentsService {
  /**
   * Records a Payment In (from Customer) or Payment Out (to Supplier)
   * with atomic ledger entry and invoice allocation.
   */
  static async recordPayment(
    orgId: string,
    data: {
      type: 'PAYMENT_IN' | 'PAYMENT_OUT';
      partyId: string;
      partyName: string;
      partyType: 'CUSTOMER' | 'SUPPLIER';
      amountRupees: number;
      discountRupees?: number;
      paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE';
      bankAccountId?: string;
      referenceNumber?: string;
      transactionDate?: string;
      allocations?: {
        invoiceId: string;
        invoiceNumber: string;
        invoiceType: 'SALE_INVOICE' | 'PURCHASE_INVOICE';
        allocatedAmountRupees: number;
      }[];
      notes?: string;
      locationId?: string;
      warehouseId?: string;
    },
    actor: { uid: string; email?: string }
  ): Promise<PaymentVoucher> {
    const now = new Date().toISOString()
    const txnDate = data.transactionDate || now.split('T')[0]!
    const periodId = await PeriodService.assertPeriodOpen(orgId, txnDate)
    const locId = data.locationId || 'default_loc'
    const whId = data.warehouseId || 'default_wh'

    const totalPaise = toPaise(data.amountRupees)
    const discountPaise = toPaise(data.discountRupees || 0)

    if (totalPaise <= 0) {
      throw new Error('Payment amount must be greater than zero.')
    }

    const paymentRef = db.collection(`organizations/${orgId}/payments`).doc()
    const partyRef = db.doc(`organizations/${orgId}/parties/${data.partyId}`)

    // Compute allocations
    let totalAllocatedPaise = 0
    const allocationEntries: PaymentAllocation[] = []

    if (data.allocations && data.allocations.length > 0) {
      for (const a of data.allocations) {
        const allocPaise = toPaise(a.allocatedAmountRupees)
        totalAllocatedPaise += allocPaise
        allocationEntries.push({
          id: db.collection(`organizations/${orgId}/paymentAllocations`).doc().id,
          orgId,
          paymentId: paymentRef.id,
          invoiceId: a.invoiceId,
          invoiceType: a.invoiceType,
          allocatedAmount: allocPaise,
          allocatedAt: now,
        })
      }
    }

    if (totalAllocatedPaise > totalPaise + discountPaise) {
      throw new Error('Allocated amount cannot exceed total payment voucher amount.')
    }

    const unallocatedPaise = totalPaise + discountPaise - totalAllocatedPaise

    const paymentDoc: PaymentVoucher = {
      transactionId: paymentRef.id,
      organizationId: orgId,
      financialPeriodId: periodId,
      documentType: data.type,
      documentNumber: '', // will be allocated inside transaction
      transactionDate: txnDate,
      postingDate: now,
      status: 'POSTED',
      locationId: locId,
      warehouseId: whId,
      partyId: data.partyId,
      partyName: data.partyName,
      partyType: data.partyType,
      totalAmount: totalPaise,
      discountAmount: discountPaise,
      paymentMode: data.paymentMode,
      bankAccountId: data.bankAccountId,
      referenceNumber: data.referenceNumber,
      unallocatedAmount: unallocatedPaise,
      allocations: data.allocations
        ? data.allocations.map((a) => ({
            invoiceId: a.invoiceId,
            invoiceNumber: a.invoiceNumber,
            allocatedAmount: toPaise(a.allocatedAmountRupees),
          }))
        : [],
      notes: data.notes,
      createdBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    }

    await db.runTransaction(async (txn) => {
      const partySnap = await txn.get(partyRef)
      if (!partySnap.exists) throw new Error('Party not found.')
      const currentPartyBalance = ((partySnap.data() as any).currentBalance || 0) as number

      // Allocate Document Sequence
      const prefix = data.type === 'PAYMENT_IN' ? 'PMT-IN-' : 'PMT-OUT-'
      const docNumber = await SequenceService.allocateInTransaction(
        txn,
        orgId,
        periodId,
        data.type,
        prefix
      )
      paymentDoc.documentNumber = docNumber

      txn.set(paymentRef, paymentDoc)

      // Post allocations
      for (const alloc of allocationEntries) {
        const allocRef = db.doc(`organizations/${orgId}/paymentAllocations/${alloc.id}`)
        txn.set(allocRef, alloc)
      }

      // Authoritative Ledger Entry
      const ledgerRef = db.collection(`organizations/${orgId}/partyLedger`).doc()
      const totalSettlement = totalPaise + discountPaise

      let debit = 0
      let credit = 0
      let newBalance = currentPartyBalance

      if (data.type === 'PAYMENT_IN') {
        // Customer paid us -> Credit party (decreases receivable)
        credit = totalSettlement
        newBalance -= totalSettlement
      } else {
        // We paid supplier -> Debit party (decreases payable)
        debit = totalSettlement
        newBalance += totalSettlement
      }

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
        balanceSnapshot: newBalance,
        description: `Payment ${data.paymentMode} ${data.referenceNumber ? `Ref: ${data.referenceNumber}` : ''}`,
        createdBy: actor.uid,
        createdAt: now,
      }

      txn.set(ledgerRef, ledgerEntry)
      txn.update(partyRef, { currentBalance: newBalance, updatedAt: now })

      // Authoritative Audit Event committed atomically inside transaction
      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'POST',
        entityType: data.type,
        entityId: paymentRef.id,
        entityNumber: docNumber,
      })
    })

    return paymentDoc
  }

  /**
   * Fetches payment vouchers.
   */
  static async getPayments(orgId: string, partyId?: string): Promise<PaymentVoucher[]> {
    let query = db.collection(`organizations/${orgId}/payments`).orderBy('transactionDate', 'desc')

    if (partyId) {
      query = query.where('partyId', '==', partyId)
    }

    const snap = await query.limit(100).get()
    return snap.docs.map((d) => d.data() as PaymentVoucher)
  }
}
