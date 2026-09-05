import { Transaction } from 'firebase-admin/firestore'
import { db } from '../../config/firebase-admin'
import { AuditLog, DocumentType } from '../../types/domain.types'

export class AuditService {
  /**
   * Commits an authoritative audit event atomically inside an existing Firestore transaction.
   */
  static logInTransaction(
    txn: Transaction,
    orgId: string,
    entry: {
      actorUid: string;
      actorEmail?: string;
      action: 'CREATE' | 'UPDATE' | 'POST' | 'CANCEL' | 'REVERSE' | 'ADJUST_STOCK' | 'ROLE_CHANGE';
      entityType: DocumentType | 'PRODUCT' | 'PARTY' | 'SETTINGS';
      entityId: string;
      entityNumber?: string;
      diff?: { before?: any; after?: any };
    }
  ): void {
    const logRef = db.collection(`organizations/${orgId}/auditLogs`).doc()
    const logData: AuditLog = {
      id: logRef.id,
      orgId,
      actorUid: entry.actorUid,
      actorEmail: entry.actorEmail,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityNumber: entry.entityNumber,
      timestamp: new Date().toISOString(),
      diff: entry.diff,
    }
    txn.set(logRef, logData)
  }
}
