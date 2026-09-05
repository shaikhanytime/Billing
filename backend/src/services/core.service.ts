import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { db, auth as adminAuth } from '../config/firebase-admin'

export interface AuditPayload {
  orgId?: string
  userId?: string
  action: string
  module: string
  entityType: string
  entityId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    if (!payload.orgId) return
    await db
      .collection('organizations')
      .doc(payload.orgId)
      .collection('auditLogs')
      .add({ ...payload, createdAt: FieldValue.serverTimestamp() })
  } catch (err) {
    console.error('[AUDIT] Failed to log:', err)
  }
}

export async function generateInvoiceNumber(
  orgId: string,
  prefix: 'INV' | 'PUR' | 'QOT' | 'SCR' | 'PCR' | 'PMT' | 'PMD'
): Promise<string> {
  const year = new Date().getFullYear()
  const counterRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('counters')
    .doc(`${prefix}-${year}`)

  return db.runTransaction(async (tx: Transaction) => {
    const docSnap = await tx.get(counterRef)
    const current = docSnap.exists ? ((docSnap.data() as Record<string, unknown>)['count'] as number) : 0
    const next = current + 1
    tx.set(counterRef, { count: next, prefix, year }, { merge: true })
    return `${prefix}-${year}-${String(next).padStart(5, '0')}`
  })
}

export async function updateStock(
  orgId: string,
  productId: string,
  quantity: number,
  type: string,
  referenceId: string,
  userId: string,
  unitCost?: number
): Promise<void> {
  const stockRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('stock')
    .doc(productId)

  await db.runTransaction(async (tx: Transaction) => {
    const stockDoc = await tx.get(stockRef)
    const current = stockDoc.exists ? ((stockDoc.data() as Record<string, unknown>)['quantityOnHand'] as number ?? 0) : 0
    const newQty = current + quantity

    if (newQty < 0) {
      throw Object.assign(new Error('Insufficient stock'), { status: 400, code: 'INSUFFICIENT_STOCK' })
    }

    tx.set(stockRef, { quantityOnHand: newQty, lastUpdated: FieldValue.serverTimestamp() }, { merge: true })

    const movRef = db.collection('organizations').doc(orgId).collection('stockMovements').doc()
    tx.set(movRef, {
      orgId, productId, type, referenceId,
      quantity, unitCost: unitCost ?? null,
      balanceAfter: newQty,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    })
  })
}

export async function updatePartyLedger(params: {
  orgId: string
  partyType: 'CUSTOMER' | 'SUPPLIER'
  partyId: string
  transactionType: string
  referenceId: string
  debit: number
  credit: number
  note?: string
  userId: string
}): Promise<void> {
  const { orgId, partyType, partyId, ...rest } = params
  const partyCollection = partyType === 'CUSTOMER' ? 'customers' : 'suppliers'

  const partyRef = db.collection('organizations').doc(orgId).collection(partyCollection).doc(partyId)

  await db.runTransaction(async (tx: Transaction) => {
    const partyDoc = await tx.get(partyRef)
    const currentBalance = ((partyDoc.data() as Record<string, unknown>)?.['balance'] as number) ?? 0
    const newBalance = currentBalance + rest.debit - rest.credit

    tx.update(partyRef, { balance: newBalance })

    const ledgerRef = db.collection('organizations').doc(orgId).collection('partyLedger').doc()
    tx.set(ledgerRef, {
      orgId, partyType, partyId,
      transactionType: rest.transactionType,
      referenceId: rest.referenceId,
      debit: rest.debit,
      credit: rest.credit,
      balanceAfter: newBalance,
      note: rest.note ?? null,
      createdBy: rest.userId,
      createdAt: FieldValue.serverTimestamp(),
    })
  })
}

export { adminAuth }
