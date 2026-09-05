import { db } from '../../config/firebase-admin'
import { Party, PartyLedgerEntry } from '../../types/domain.types'
import { toPaise } from '../../utils/money'
import { AuditService } from '../audit/audit.service'

export class PartiesService {
  /**
   * Creates a new customer or supplier with atomic opening balance ledger posting.
   */
  static async createParty(
    orgId: string,
    data: {
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
      openingBalanceRupees?: number;
      openingBalanceType?: 'DR' | 'CR'; // DR = Receivable (+), CR = Payable (-)
      creditPeriodDays?: number;
      creditLimitRupees?: number;
    },
    actor: { uid: string; email?: string }
  ): Promise<Party> {
    const partyRef = db.collection(`organizations/${orgId}/parties`).doc()
    const now = new Date().toISOString()

    const rawOpeningRupees = data.openingBalanceRupees || 0
    const isDr = (data.openingBalanceType || 'DR') === 'DR'
    const openingPaise = isDr ? toPaise(rawOpeningRupees) : -toPaise(rawOpeningRupees)
    const creditLimitPaise = toPaise(data.creditLimitRupees || 0)

    const partyDoc: Party = {
      id: partyRef.id,
      orgId,
      name: data.name.trim(),
      type: data.type,
      category: data.category?.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || undefined,
      gstin: data.gstin?.trim().toUpperCase() || undefined,
      pan: data.pan?.trim().toUpperCase() || (data.gstin ? data.gstin.slice(2, 12).toUpperCase() : undefined),
      billingAddress: data.billingAddress,
      shippingAddress: data.shippingAddress || data.billingAddress,
      openingBalance: openingPaise,
      currentBalance: openingPaise,
      creditPeriodDays: data.creditPeriodDays || 0,
      creditLimit: creditLimitPaise,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    }

    await db.runTransaction(async (txn) => {
      txn.set(partyRef, partyDoc)

      // If non-zero opening balance, post atomic opening entry to partyLedger
      if (openingPaise !== 0) {
        const ledgerRef = db.collection(`organizations/${orgId}/partyLedger`).doc()
        const ledgerEntry: PartyLedgerEntry = {
          id: ledgerRef.id,
          orgId,
          partyId: partyRef.id,
          transactionId: `OPENING_${partyRef.id}`,
          documentType: 'PAYMENT_IN', // baseline classification
          documentNumber: 'OPENING_BAL',
          date: now.split('T')[0]!,
          debit: openingPaise > 0 ? openingPaise : 0,
          credit: openingPaise < 0 ? Math.abs(openingPaise) : 0,
          balanceSnapshot: openingPaise,
          description: 'Opening Balance Baseline',
          createdBy: actor.uid,
          createdAt: now,
        }
        txn.set(ledgerRef, ledgerEntry)
      }

      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'CREATE',
        entityType: 'PARTY',
        entityId: partyRef.id,
        entityNumber: partyDoc.name,
      })
    })

    return partyDoc
  }

  /**
   * Updates party details.
   */
  static async updateParty(
    orgId: string,
    partyId: string,
    updates: Partial<Party>,
    actor: { uid: string; email?: string }
  ): Promise<void> {
    const partyRef = db.doc(`organizations/${orgId}/parties/${partyId}`)
    await db.runTransaction(async (txn) => {
      const snap = await txn.get(partyRef)
      if (!snap.exists) throw new Error('Party not found.')

      const before = snap.data()
      const sanitized: Record<string, any> = { ...updates, updatedAt: new Date().toISOString() }
      delete sanitized['id']
      delete sanitized['orgId']
      delete sanitized['openingBalance']
      delete sanitized['currentBalance'] // Balance must only be changed via Ledger

      txn.update(partyRef, sanitized)

      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'UPDATE',
        entityType: 'PARTY',
        entityId: partyId,
        diff: { before, after: sanitized },
      })
    })
  }

  /**
   * Fetches party list with filtering and search.
   */
  static async getParties(
    orgId: string,
    options: {
      type?: 'CUSTOMER' | 'SUPPLIER';
      search?: string;
      category?: string;
      balanceFilter?: 'RECEIVABLE' | 'PAYABLE' | 'ZERO';
      limit?: number;
    }
  ): Promise<Party[]> {
    let query: FirebaseFirestore.Query = db.collection(`organizations/${orgId}/parties`)

    if (options.type) {
      query = query.where('type', 'in', [options.type, 'BOTH'])
    }
    if (options.category) {
      query = query.where('category', '==', options.category)
    }

    const snap = await query.limit(options.limit || 100).get()
    let parties = snap.docs.map((d) => d.data() as Party)

    if (options.search) {
      const q = options.search.toLowerCase()
      parties = parties.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.gstin && p.gstin.toLowerCase().includes(q))
      )
    }

    if (options.balanceFilter === 'RECEIVABLE') {
      parties = parties.filter((p) => p.currentBalance > 0)
    } else if (options.balanceFilter === 'PAYABLE') {
      parties = parties.filter((p) => p.currentBalance < 0)
    } else if (options.balanceFilter === 'ZERO') {
      parties = parties.filter((p) => p.currentBalance === 0)
    }

    return parties
  }

  /**
   * Retrieves party statement ledger entries with date-range filter.
   */
  static async getPartyLedger(
    orgId: string,
    partyId: string,
    startDate?: string,
    endDate?: string
  ): Promise<PartyLedgerEntry[]> {
    let query = db
      .collection(`organizations/${orgId}/partyLedger`)
      .where('partyId', '==', partyId)
      .orderBy('date', 'asc')

    if (startDate) {
      query = query.where('date', '>=', startDate)
    }
    if (endDate) {
      query = query.where('date', '<=', endDate)
    }

    const snap = await query.get()
    return snap.docs.map((d) => d.data() as PartyLedgerEntry)
  }

  /**
   * Recalculates party balance authoritatively from immutable ledger entries.
   */
  static async reconcilePartyBalance(orgId: string, partyId: string): Promise<number> {
    const partyRef = db.doc(`organizations/${orgId}/parties/${partyId}`)
    const ledgerSnap = await db
      .collection(`organizations/${orgId}/partyLedger`)
      .where('partyId', '==', partyId)
      .get()

    let totalDebit = 0
    let totalCredit = 0

    ledgerSnap.docs.forEach((doc) => {
      const entry = doc.data() as PartyLedgerEntry
      totalDebit += entry.debit || 0
      totalCredit += entry.credit || 0
    })

    const calculatedBalance = totalDebit - totalCredit
    await partyRef.update({ currentBalance: calculatedBalance, updatedAt: new Date().toISOString() })
    return calculatedBalance
  }
}
