import { db } from '../../config/firebase-admin'
import {
  PurchaseInvoice,
  PurchaseLineItem,
  StockBalance,
  StockMovement,
  PartyLedgerEntry,
  PaymentVoucher,
  PaymentAllocation,
  Product,
} from '../../types/domain.types'
import { SequenceService } from '../sequence/sequence.service'
import { PeriodService } from '../periods/period.service'
import { TaxEngine } from '../tax/tax.engine'
import { AuditService } from '../audit/audit.service'

export interface CreatePurchaseInvoiceInput {
  documentType?: 'PURCHASE_INVOICE' | 'PURCHASE_RETURN';
  vendorBillNumber: string;
  vendorBillDate: string;
  invoiceDate: string;           // ISO YYYY-MM-DD
  dueDate?: string;
  partyId: string;               // Supplier ID
  partyName: string;
  partyGstin?: string;
  partyStateCode?: string;
  placeOfSupply: string;         // 2-digit state code
  warehouseId: string;
  locationId?: string;
  items: {
    productId: string;
    quantity: number;            // Scaled base units (e.g. 1000 = 1.000)
    unitCostPaise: number;       // In Paise
    isTaxInclusive?: boolean;
    discountPercent?: number;
    discountPaise?: number;
    taxRate: 0 | 5 | 12 | 18 | 28;
  }[];
  discountPaise?: number;
  additionalChargesPaise?: number;
  payment?: {
    paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE';
    amountPaise: number;
    bankAccountId?: string;
    referenceNumber?: string;
  };
  rcmApplicable?: boolean;
  notes?: string;
}

export class PurchasesService {
  /**
   * Atomically creates and posts a Purchase Inward Invoice and updates inventory WAC.
   */
  static async createInvoice(
    orgId: string,
    input: CreatePurchaseInvoiceInput,
    actor: { uid: string; email?: string }
  ): Promise<PurchaseInvoice> {
    const docType = input.documentType || 'PURCHASE_INVOICE'
    const locationId = input.locationId || 'DEFAULT'
    const warehouseId = input.warehouseId || 'MAIN'
    const now = new Date().toISOString()
    const invoiceDate = input.invoiceDate || now.slice(0, 10)

    // 1. Fetch Organization settings for state code
    const orgDoc = await db.collection('organizations').doc(orgId).get()
    if (!orgDoc.exists) throw new Error('Organization not found.')
    const orgData = orgDoc.data() || {}
    const companyStateCode = orgData.stateCode || orgData.gstin?.slice(0, 2) || '27'

    // 2. Validate Financial Period
    const periodId = await PeriodService.assertPeriodOpen(orgId, invoiceDate)

    return await db.runTransaction(async (txn) => {
      // Generate sequential internal purchase number
      const prefix = docType === 'PURCHASE_RETURN' ? 'PR-' : 'PUR-'
      const invoiceNumber = await SequenceService.allocateInTransaction(
        txn,
        orgId,
        periodId,
        docType,
        prefix
      )

      // Fetch all products involved
      const productDocs: { [id: string]: Product } = {}
      const stockBalanceDocs: { [id: string]: StockBalance } = {}

      for (const item of input.items) {
        if (!productDocs[item.productId]) {
          const pRef = db.collection(`organizations/${orgId}/products`).doc(item.productId)
          const pSnap = await txn.get(pRef)
          if (!pSnap.exists) throw new Error(`Product ${item.productId} not found.`)
          productDocs[item.productId] = pSnap.data() as Product

          // Stock balance
          const sbId = `${orgId}_${locationId}_${warehouseId}_${item.productId}`
          const sbRef = db.collection(`organizations/${orgId}/stockBalances`).doc(sbId)
          const sbSnap = await txn.get(sbRef)
          if (sbSnap.exists) {
            stockBalanceDocs[item.productId] = sbSnap.data() as StockBalance
          } else {
            stockBalanceDocs[item.productId] = {
              id: sbId,
              orgId,
              locationId,
              warehouseId,
              productId: item.productId,
              quantity: 0,
              averageCost: 0,
              updatedAt: now,
            }
          }
        }
      }

      // Resolve Tax Treatment
      const taxTreatment = TaxEngine.resolveTaxTreatment({
        companyStateCode,
        partyStateCode: input.partyStateCode,
        placeOfSupply: input.placeOfSupply,
        isSEZ: false,
        isExport: false,
      })

      // Calculate Line Items
      let totalTaxablePaise = 0
      let totalCgstPaise = 0
      let totalSgstPaise = 0
      let totalIgstPaise = 0
      const processedItems: PurchaseLineItem[] = []

      for (const item of input.items) {
        const product = productDocs[item.productId]
        const lineGrossPaise = Math.round((item.quantity * item.unitCostPaise) / 1000)

        const discPercent = item.discountPercent || 0
        const percentDiscountPaise = Math.round((lineGrossPaise * discPercent) / 100)
        const itemDiscountPaise = percentDiscountPaise + (item.discountPaise || 0)
        const netLineGrossPaise = Math.max(0, lineGrossPaise - itemDiscountPaise)

        const lineTaxCalc = TaxEngine.calculateLineTaxPaise(
          netLineGrossPaise,
          item.taxRate,
          item.isTaxInclusive || false,
          taxTreatment
        )

        totalTaxablePaise += lineTaxCalc.taxableAmountPaise
        totalCgstPaise += lineTaxCalc.cgstPaise
        totalSgstPaise += lineTaxCalc.sgstPaise
        totalIgstPaise += lineTaxCalc.igstPaise

        processedItems.push({
          id: `item_${processedItems.length + 1}`,
          productId: item.productId,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          hsnCode: product.hsnCode || 'N/A',
          unit: product.baseUnitSymbol || 'PCS',
          quantity: item.quantity,
          unitCostPaise: item.unitCostPaise,
          isTaxInclusive: item.isTaxInclusive || false,
          discountPercent: discPercent,
          discountPaise: itemDiscountPaise,
          taxRate: item.taxRate,
          taxablePaise: lineTaxCalc.taxableAmountPaise,
          cgstPaise: lineTaxCalc.cgstPaise,
          sgstPaise: lineTaxCalc.sgstPaise,
          igstPaise: lineTaxCalc.igstPaise,
          totalTaxPaise: lineTaxCalc.totalTaxPaise,
          totalPaise: lineTaxCalc.totalPaise,
        })
      }

      const invoiceDiscountPaise = input.discountPaise || 0
      const additionalChargesPaise = input.additionalChargesPaise || 0
      const rawNetTotalPaise =
        totalTaxablePaise +
        totalCgstPaise +
        totalSgstPaise +
        totalIgstPaise -
        invoiceDiscountPaise +
        additionalChargesPaise

      const roundedTotalPaise = Math.round(rawNetTotalPaise / 100) * 100
      const roundOffPaise = roundedTotalPaise - rawNetTotalPaise

      const initialPaidPaise = input.payment ? Math.min(input.payment.amountPaise, roundedTotalPaise) : 0
      const balanceDuePaise = roundedTotalPaise - initialPaidPaise
      const paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
        balanceDuePaise === 0 ? 'PAID' : initialPaidPaise > 0 ? 'PARTIAL' : 'UNPAID'

      const invoiceRef = db.collection(`organizations/${orgId}/purchases`).doc()
      const invoiceId = invoiceRef.id

      const invoiceData: PurchaseInvoice = {
        transactionId: invoiceId,
        organizationId: orgId,
        financialPeriodId: periodId,
        documentType: docType,
        documentNumber: invoiceNumber,
        vendorBillNumber: input.vendorBillNumber,
        vendorBillDate: input.vendorBillDate,
        transactionDate: invoiceDate,
        postingDate: now,
        status: 'POSTED',
        locationId,
        warehouseId,
        partyId: input.partyId,
        partyName: input.partyName,
        partyGstin: input.partyGstin,
        partyStateCode: input.partyStateCode,
        placeOfSupply: input.placeOfSupply,
        dueDate: input.dueDate || invoiceDate,
        items: processedItems,
        subtotalPaise: totalTaxablePaise,
        taxableAmountPaise: totalTaxablePaise,
        cgstAmountPaise: totalCgstPaise,
        sgstAmountPaise: totalSgstPaise,
        igstAmountPaise: totalIgstPaise,
        totalTaxPaise: totalCgstPaise + totalSgstPaise + totalIgstPaise,
        discountPaise: invoiceDiscountPaise,
        additionalChargesPaise: additionalChargesPaise,
        roundOffPaise: roundOffPaise,
        totalAmountPaise: roundedTotalPaise,
        paidAmountPaise: initialPaidPaise,
        balanceDuePaise: balanceDuePaise,
        paymentStatus,
        rcmApplicable: input.rcmApplicable || false,
        notes: input.notes,
        createdBy: actor.uid,
        createdAt: now,
        updatedAt: now,
      }

      txn.set(invoiceRef, invoiceData)

      // Inventory & WAC Update
      for (const item of processedItems) {
        const product = productDocs[item.productId]
        if (product.trackInventory) {
          const currentSb = stockBalanceDocs[item.productId]
          const currentQty = currentSb.quantity
          const currentWac = currentSb.averageCost // Micro-Paise
          const inwardCostMicroPaise = item.unitCostPaise * 100 // Convert Paise to Micro-Paise

          // Calculate new Weighted Average Cost
          let newWac = inwardCostMicroPaise
          const newQty = currentQty + item.quantity
          if (currentQty > 0 && newQty > 0) {
            newWac = Math.round((currentQty * currentWac + item.quantity * inwardCostMicroPaise) / newQty)
          }

          const sbRef = db.collection(`organizations/${orgId}/stockBalances`).doc(currentSb.id)
          txn.set(
            sbRef,
            {
              ...currentSb,
              quantity: newQty,
              averageCost: newWac,
              updatedAt: now,
            },
            { merge: true }
          )

          // Product aggregate stock & cost
          const prodRef = db.collection(`organizations/${orgId}/products`).doc(item.productId)
          txn.update(prodRef, {
            stockQty: (product.stockQty || 0) + item.quantity,
            purchaseCost: item.unitCostPaise,
            updatedAt: now,
          })

          // Stock Movement
          const smRef = db.collection(`organizations/${orgId}/stockMovements`).doc()
          const smData: StockMovement = {
            id: smRef.id,
            orgId,
            locationId,
            warehouseId,
            productId: item.productId,
            movementType: 'INWARD_PURCHASE',
            referenceType: docType,
            referenceId: invoiceId,
            referenceNumber: invoiceNumber,
            baseQuantity: item.quantity,
            unitCost: inwardCostMicroPaise,
            totalValuation: item.taxablePaise,
            balanceSnapshot: newQty,
            occurredAt: invoiceDate,
            createdBy: actor.uid,
          }
          txn.set(smRef, smData)
        }
      }

      // Party Ledger & Balance Update (Supplier Payable Credit)
      const partyRef = db.collection(`organizations/${orgId}/parties`).doc(input.partyId)
      const partySnap = await txn.get(partyRef)

      if (partySnap.exists) {
        const partyData = partySnap.data() || {}
        const currentBal = partyData.currentBalance || 0
        // Credit increases payable (negative balance in receivable convention, or debit/credit explicit)
        const updatedBalAfterPurchase = currentBal - roundedTotalPaise

        const plRef = db.collection(`organizations/${orgId}/partyLedger`).doc()
        const plData: PartyLedgerEntry = {
          id: plRef.id,
          orgId,
          partyId: input.partyId,
          transactionId: invoiceId,
          documentType: docType,
          documentNumber: invoiceNumber,
          date: invoiceDate,
          debit: 0,
          credit: roundedTotalPaise,
          balanceSnapshot: updatedBalAfterPurchase,
          description: `Purchase Bill #${input.vendorBillNumber || invoiceNumber}`,
          createdBy: actor.uid,
          createdAt: now,
        }
        txn.set(plRef, plData)

        let finalPartyBal = updatedBalAfterPurchase

        // If upfront payment provided, create Payment Out
        if (initialPaidPaise > 0 && input.payment) {
          const payNumber = await SequenceService.allocateInTransaction(
            txn,
            orgId,
            periodId,
            'PAYMENT_OUT',
            'PO-'
          )
          const payRef = db.collection(`organizations/${orgId}/payments`).doc()
          finalPartyBal = updatedBalAfterPurchase + initialPaidPaise

          const payVoucher: PaymentVoucher = {
            transactionId: payRef.id,
            organizationId: orgId,
            financialPeriodId: periodId,
            documentType: 'PAYMENT_OUT',
            documentNumber: payNumber,
            transactionDate: invoiceDate,
            postingDate: now,
            status: 'POSTED',
            locationId,
            warehouseId,
            partyId: input.partyId,
            partyName: input.partyName,
            partyType: 'SUPPLIER',
            paymentAmountPaise: initialPaidPaise,
            discountPaise: 0,
            settlementAmountPaise: initialPaidPaise,
            unallocatedPaymentAmountPaise: 0,
            totalAmount: initialPaidPaise,
            discountAmount: 0,
            paymentMode: input.payment.paymentMode,
            bankAccountId: input.payment.bankAccountId,
            referenceNumber: input.payment.referenceNumber,
            unallocatedAmount: 0,
            allocations: [
              {
                invoiceId,
                invoiceNumber,
                invoiceType: 'PURCHASE_INVOICE',
                paymentAllocatedPaise: initialPaidPaise,
                discountAllocatedPaise: 0,
                settlementAllocatedPaise: initialPaidPaise,
                allocatedAmount: initialPaidPaise,
              },
            ],
            createdBy: actor.uid,
            createdAt: now,
            updatedAt: now,
          }
          txn.set(payRef, payVoucher)

          const allocRef = db.collection(`organizations/${orgId}/paymentAllocations`).doc()
          const allocData: PaymentAllocation = {
            id: allocRef.id,
            orgId,
            paymentId: payRef.id,
            invoiceId,
            invoiceType: 'PURCHASE_INVOICE',
            invoiceNumber,
            paymentAllocatedPaise: initialPaidPaise,
            discountAllocatedPaise: 0,
            settlementAllocatedPaise: initialPaidPaise,
            allocatedAmount: initialPaidPaise,
            allocatedAt: now,
          }
          txn.set(allocRef, allocData)

          const plPayRef = db.collection(`organizations/${orgId}/partyLedger`).doc()
          const plPayData: PartyLedgerEntry = {
            id: plPayRef.id,
            orgId,
            partyId: input.partyId,
            transactionId: payRef.id,
            documentType: 'PAYMENT_OUT',
            documentNumber: payNumber,
            date: invoiceDate,
            debit: initialPaidPaise,
            credit: 0,
            balanceSnapshot: finalPartyBal,
            description: `Payment for Purchase #${invoiceNumber}`,
            createdBy: actor.uid,
            createdAt: now,
          }
          txn.set(plPayRef, plPayData)
        }

        txn.update(partyRef, {
          currentBalance: finalPartyBal,
          updatedAt: now,
        })
      }

      // Authoritative Audit Log inside Transaction
      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'POST',
        entityType: docType,
        entityId: invoiceId,
        entityNumber: invoiceNumber,
        diff: {
          after: {
            totalAmountPaise: roundedTotalPaise,
            vendorBillNumber: input.vendorBillNumber,
            itemsCount: processedItems.length,
            paymentStatus,
          },
        },
      })

      return invoiceData
    })
  }

  /**
   * Retrieves paginated purchase invoices.
   */
  static async getInvoices(
    orgId: string,
    options: {
      partyId?: string;
      startDate?: string;
      endDate?: string;
      paymentStatus?: string;
      limit?: number;
    }
  ): Promise<PurchaseInvoice[]> {
    let query: FirebaseFirestore.Query = db.collection(`organizations/${orgId}/purchases`)

    if (options.partyId) {
      query = query.where('partyId', '==', options.partyId)
    }
    if (options.paymentStatus) {
      query = query.where('paymentStatus', '==', options.paymentStatus)
    }
    if (options.startDate) {
      query = query.where('transactionDate', '>=', options.startDate)
    }
    if (options.endDate) {
      query = query.where('transactionDate', '<=', options.endDate)
    }

    query = query.orderBy('transactionDate', 'desc').limit(options.limit || 50)
    const snap = await query.get()
    return snap.docs.map((d) => d.data() as PurchaseInvoice)
  }

  /**
   * Retrieves single purchase invoice by ID.
   */
  static async getInvoiceById(orgId: string, invoiceId: string): Promise<PurchaseInvoice | null> {
    const doc = await db.collection(`organizations/${orgId}/purchases`).doc(invoiceId).get()
    if (!doc.exists) return null
    return doc.data() as PurchaseInvoice
  }
}
