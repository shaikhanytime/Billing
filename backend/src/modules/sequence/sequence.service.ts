import { Transaction, DocumentReference } from 'firebase-admin/firestore'
import { db } from '../../config/firebase-admin'
import { DocumentType } from '../../types/domain.types'

/**
 * Atomic Concurrency-Safe Sequence Generator
 * Guarantees monotonic sequence allocation without duplicate document numbers during concurrent checkouts.
 */
export class SequenceService {
  /**
   * Generates the next sequential document number within an existing Firestore transaction.
   */
  static async allocateInTransaction(
    txn: Transaction,
    orgId: string,
    financialPeriodId: string,
    docType: DocumentType,
    prefix: string,
    padding: number = 5
  ): Promise<string> {
    const seqDocId = `${financialPeriodId}_${docType}`
    const seqRef = db.doc(`organizations/${orgId}/documentSequences/${seqDocId}`)

    const snap = await txn.get(seqRef)
    let nextVal = 1

    if (snap.exists) {
      nextVal = ((snap.data() as any)?.currentValue || 0) + 1
      txn.update(seqRef, {
        currentValue: nextVal,
        updatedAt: new Date().toISOString(),
      })
    } else {
      txn.set(seqRef, {
        orgId,
        financialPeriodId,
        documentType: docType,
        prefix,
        currentValue: nextVal,
        paddingLength: padding,
        updatedAt: new Date().toISOString(),
      })
    }

    const paddedNumber = String(nextVal).padStart(padding, '0')
    return `${prefix}${paddedNumber}`
  }

  /**
   * Standalone atomic sequence allocation (runs its own transaction).
   */
  static async allocateNext(
    orgId: string,
    financialPeriodId: string,
    docType: DocumentType,
    prefix: string,
    padding: number = 5
  ): Promise<string> {
    return await db.runTransaction(async (txn) => {
      return await this.allocateInTransaction(txn, orgId, financialPeriodId, docType, prefix, padding)
    })
  }
}
