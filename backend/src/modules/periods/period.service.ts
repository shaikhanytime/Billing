import { db } from '../../config/firebase-admin'
import { FinancialPeriod } from '../../types/domain.types'

export class PeriodService {
  /**
   * Derives default financial period ID from a date (Indian FY: April 1 to March 31).
   */
  static derivePeriodId(dateStr: string): string {
    const d = new Date(dateStr)
    const year = d.getFullYear()
    const month = d.getMonth() + 1 // 1-12

    // If month is Jan, Feb, Mar (1,2,3), FY started in previous year
    const startYear = month <= 3 ? year - 1 : year
    const endYearShort = String(startYear + 1).slice(-2)
    return `FY-${startYear}-${endYearShort}`
  }

  /**
   * Asserts that the given transaction date falls within an OPEN financial period.
   * Throws Error if period is CLOSED.
   */
  static async assertPeriodOpen(orgId: string, transactionDate: string): Promise<string> {
    const periodId = this.derivePeriodId(transactionDate)
    const periodRef = db.doc(`organizations/${orgId}/financialPeriods/${periodId}`)
    const snap = await periodRef.get()

    if (snap.exists) {
      const data = snap.data() as FinancialPeriod
      if (data.status === 'CLOSED') {
        throw new Error(`Financial period ${periodId} is CLOSED. No modifications permitted.`)
      }
    } else {
      // Auto-initialize open period document if first transaction
      const startYear = parseInt(periodId.split('-')[1]!, 10)
      await periodRef.set({
        id: periodId,
        orgId,
        name: `Financial Year ${startYear}-20${periodId.split('-')[2]}`,
        startDate: `${startYear}-04-01`,
        endDate: `${startYear + 1}-03-31`,
        status: 'OPEN',
      })
    }

    return periodId
  }
}
