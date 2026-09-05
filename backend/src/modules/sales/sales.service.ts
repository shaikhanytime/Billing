import { db } from '../../config/firebase-admin'
import {
  SaleInvoice,
  SaleLineItem,
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

export interface CreateSaleInvoiceInput {
  documentType?: 'SALE_INVOICE' | 'POS_SALE' | 'QUOTATION';
  invoiceDate: string;           // ISO YYYY-MM-DD
  dueDate?: string;
  partyId?: string;
  partyName: string;
  partyPhone?: string;
  partyGstin?: string;
  partyStateCode?: string;
  billingAddress?: {
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
  placeOfSupply: string;         // 2-digit state code
  warehouseId: string;
  locationId?: string;
  items: {
    productId: string;
    quantity: number;            // Scaled base units (e.g. 1000 = 1.000)
    unitPricePaise: number;      // In Paise
    isTaxInclusive?: boolean;
    discountPercent?: number;    // e.g. 5 for 5%
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
  notes?: string;
  termsAndConditions?: string;
  isPosSale?: boolean;
}

export class SalesService {
  /**
   * Authoritative transaction helper for executing Sales Invoice financial and inventory posting.
   * Reused identically across Direct Sales, POS Billing, and Quotation Conversion.
   */
  static async postSalesInvoiceInTransaction(
    txn: FirebaseFirestore.Transaction,
    orgId: string,
    periodId: string,
    invoiceRef: FirebaseFirestore.DocumentReference,
    invoiceData: SaleInvoice,
    allowNegativeStock: boolean,
    actor: { uid: string; email?: string },
    payment?: CreateSaleInvoiceInput['payment']
  ): Promise<SaleInvoice> {
    const now = new Date().toISOString()
    const invoiceId = invoiceRef.id
    const invoiceNumber = invoiceData.documentNumber
    const locationId = invoiceData.locationId
    const warehouseId = invoiceData.warehouseId
    const affectsInventory = invoiceData.documentType !== 'QUOTATION'

    // Fetch and validate all products & stock balances
    const productDocs: { [id: string]: Product } = {}
    const stockBalanceDocs: { [id: string]: StockBalance } = {}

    for (const item of invoiceData.items) {
      if (!productDocs[item.productId]) {
        const pRef = db.collection(`organizations/${orgId}/products`).doc(item.productId)
        const pSnap = await txn.get(pRef)
        if (!pSnap.exists) throw new Error(`Product ${item.productId} not found.`)
        const prod = pSnap.data() as Product
        if (prod.status === 'INACTIVE') {
          throw new Error(`Product "${prod.name}" is inactive and cannot be invoiced.`)
        }
        productDocs[item.productId] = prod

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

    // Check stock availability
    if (affectsInventory && !allowNegativeStock) {
      for (const item of invoiceData.items) {
        const product = productDocs[item.productId]!
        if (product.trackInventory) {
          const currentStock = stockBalanceDocs[item.productId]!.quantity
          if (currentStock < item.quantity) {
            const avail = (currentStock / 1000).toFixed(3)
            const req = (item.quantity / 1000).toFixed(3)
            throw new Error(
              `Insufficient stock for "${product.name}". Available: ${avail} ${product.baseUnitSymbol}, Required: ${req} ${product.baseUnitSymbol}.`
            )
          }
        }
      }
    }

    // 1. Write Sales Invoice Document
    txn.set(invoiceRef, invoiceData)

    // 2. Deduct Inventory & Record Stock Movement Ledger
    if (affectsInventory) {
      for (const item of invoiceData.items) {
        const product = productDocs[item.productId]!
        if (product.trackInventory) {
          const currentSb = stockBalanceDocs[item.productId]!
          const newQty = currentSb.quantity - item.quantity
          const sbRef = db.collection(`organizations/${orgId}/stockBalances`).doc(currentSb.id)

          txn.set(
            sbRef,
            {
              ...currentSb,
              quantity: newQty,
              updatedAt: now,
            },
            { merge: true }
          )

          // Update Product aggregate cached stock
          const prodRef = db.collection(`organizations/${orgId}/products`).doc(item.productId)
          txn.update(prodRef, {
            stockQty: (product.stockQty || 0) - item.quantity,
            updatedAt: now,
          })

          // Stock Movement Ledger Entry
          const smRef = db.collection(`organizations/${orgId}/stockMovements`).doc()
          const smData: StockMovement = {
            id: smRef.id,
            orgId,
            locationId,
            warehouseId,
            productId: item.productId,
            movementType: 'OUTWARD_SALE',
            referenceType: invoiceData.documentType,
            referenceId: invoiceId,
            referenceNumber: invoiceNumber,
            baseQuantity: -item.quantity,
            unitCost: item.costPriceMicroPaise || currentSb.averageCost || 0,
            totalValuation: Math.round(((item.costPriceMicroPaise || currentSb.averageCost || 0) * (item.quantity / 1000)) / 10000),
            balanceSnapshot: newQty,
            occurredAt: invoiceData.transactionDate,
            createdBy: actor.uid,
          }
          txn.set(smRef, smData)
        }
      }
    }

    // 3. Post Customer Receivable to Party Ledger & Update Party Balance
    if (invoiceData.partyId && affectsInventory) {
      const partyRef = db.collection(`organizations/${orgId}/parties`).doc(invoiceData.partyId)
      const partySnap = await txn.get(partyRef)

      if (partySnap.exists) {
        const partyData = partySnap.data() || {}
        const currentBal = partyData.currentBalance || 0
        const updatedBalAfterInvoice = currentBal + invoiceData.totalAmountPaise

        // Debit entry for full invoice amount (receivable created)
        const plRef = db.collection(`organizations/${orgId}/partyLedger`).doc()
        const plData: PartyLedgerEntry = {
          id: plRef.id,
          orgId,
          partyId: invoiceData.partyId,
          transactionId: invoiceId,
          documentType: invoiceData.documentType,
          documentNumber: invoiceNumber,
          date: invoiceData.transactionDate,
          debit: invoiceData.totalAmountPaise,
          credit: 0,
          balanceSnapshot: updatedBalAfterInvoice,
          description: `Sales Invoice #${invoiceNumber}`,
          createdBy: actor.uid,
          createdAt: now,
        }
        txn.set(plRef, plData)

        let finalPartyBal = updatedBalAfterInvoice

        // If upfront payment provided, create Payment Voucher & Credit entry
        if (invoiceData.paidAmountPaise > 0 && payment) {
          const payNumber = await SequenceService.allocateInTransaction(
            txn,
            orgId,
            periodId,
            'PAYMENT_IN',
            'PAY-'
          )
          const payRef = db.collection(`organizations/${orgId}/payments`).doc()
          finalPartyBal = updatedBalAfterInvoice - invoiceData.paidAmountPaise

          const payVoucher: PaymentVoucher = {
            transactionId: payRef.id,
            organizationId: orgId,
            financialPeriodId: periodId,
            documentType: 'PAYMENT_IN',
            documentNumber: payNumber,
            transactionDate: invoiceData.transactionDate,
            postingDate: now,
            status: 'POSTED',
            locationId,
            warehouseId,
            partyId: invoiceData.partyId,
            partyName: invoiceData.partyName,
            partyType: 'CUSTOMER',
            paymentAmountPaise: invoiceData.paidAmountPaise,
            discountPaise: 0,
            settlementAmountPaise: invoiceData.paidAmountPaise,
            unallocatedPaymentAmountPaise: 0,
            totalAmount: invoiceData.paidAmountPaise,
            discountAmount: 0,
            paymentMode: payment.paymentMode,
            bankAccountId: payment.bankAccountId,
            referenceNumber: payment.referenceNumber,
            unallocatedAmount: 0,
            allocations: [
              {
                invoiceId,
                invoiceNumber,
                invoiceType: 'SALE_INVOICE',
                paymentAllocatedPaise: invoiceData.paidAmountPaise,
                discountAllocatedPaise: 0,
                settlementAllocatedPaise: invoiceData.paidAmountPaise,
                allocatedAmount: invoiceData.paidAmountPaise,
              },
            ],
            createdBy: actor.uid,
            createdAt: now,
            updatedAt: now,
          }
          txn.set(payRef, payVoucher)

          // Allocation record
          const allocRef = db.collection(`organizations/${orgId}/paymentAllocations`).doc()
          const allocData: PaymentAllocation = {
            id: allocRef.id,
            orgId,
            paymentId: payRef.id,
            invoiceId,
            invoiceType: 'SALE_INVOICE',
            invoiceNumber,
            paymentAllocatedPaise: invoiceData.paidAmountPaise,
            discountAllocatedPaise: 0,
            settlementAllocatedPaise: invoiceData.paidAmountPaise,
            allocatedAmount: invoiceData.paidAmountPaise,
            allocatedAt: now,
          }
          txn.set(allocRef, allocData)

          // Ledger credit entry
          const plPayRef = db.collection(`organizations/${orgId}/partyLedger`).doc()
          const plPayData: PartyLedgerEntry = {
            id: plPayRef.id,
            orgId,
            partyId: invoiceData.partyId,
            transactionId: payRef.id,
            documentType: 'PAYMENT_IN',
            documentNumber: payNumber,
            date: invoiceData.transactionDate,
            debit: 0,
            credit: invoiceData.paidAmountPaise,
            balanceSnapshot: finalPartyBal,
            description: `Payment for Invoice #${invoiceNumber}`,
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
    }

    // 4. Authoritative Audit Log inside Transaction
    AuditService.logInTransaction(txn, orgId, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: 'POST',
      entityType: invoiceData.documentType,
      entityId: invoiceId,
      entityNumber: invoiceNumber,
      diff: {
        after: {
          totalAmountPaise: invoiceData.totalAmountPaise,
          itemsCount: invoiceData.items.length,
          paymentStatus: invoiceData.paymentStatus,
        },
      },
    })

    return invoiceData
  }

  /**
   * Atomically creates and posts a Sales Invoice or POS Sale.
   */
  static async createInvoice(
    orgId: string,
    input: CreateSaleInvoiceInput,
    actor: { uid: string; email?: string }
  ): Promise<SaleInvoice> {
    const isPos = input.isPosSale || input.documentType === 'POS_SALE'
    const docType = input.documentType || (isPos ? 'POS_SALE' : 'SALE_INVOICE')
    const locationId = input.locationId || 'DEFAULT'
    const warehouseId = input.warehouseId || 'MAIN'
    const now = new Date().toISOString()
    const invoiceDate = input.invoiceDate || now.slice(0, 10)

    // 1. Fetch Organization settings for state code & negative stock policy
    const orgDoc = await db.collection('organizations').doc(orgId).get()
    if (!orgDoc.exists) throw new Error('Organization not found.')
    const orgData = orgDoc.data() || {}
    const companyStateCode = orgData.stateCode || orgData.gstin?.slice(0, 2) || '27'
    const allowNegativeStock = orgData.settings?.allowNegativeStock === true

    // 2. Validate Financial Period
    const periodId = await PeriodService.assertPeriodOpen(orgId, invoiceDate)

    return await db.runTransaction(async (txn) => {
      // Generate sequential invoice number
      const prefix = isPos ? 'POS-' : docType === 'QUOTATION' ? 'EST-' : 'INV-'
      const invoiceNumber = await SequenceService.allocateInTransaction(
        txn,
        orgId,
        periodId,
        docType,
        prefix
      )

      // Fetch products for line item calculation
      const productDocs: { [id: string]: Product } = {}
      for (const item of input.items) {
        if (!productDocs[item.productId]) {
          const pRef = db.collection(`organizations/${orgId}/products`).doc(item.productId)
          const pSnap = await txn.get(pRef)
          if (!pSnap.exists) throw new Error(`Product ${item.productId} not found.`)
          productDocs[item.productId] = pSnap.data() as Product
        }
      }

      // Resolve Tax Treatment (Intra-State vs Inter-State)
      const taxTreatment = TaxEngine.resolveTaxTreatment({
        companyStateCode,
        partyStateCode: input.partyStateCode,
        placeOfSupply: input.placeOfSupply,
        isSEZ: false,
        isExport: false,
      })

      // Calculate Line Items with exact Paise math
      let totalTaxablePaise = 0
      let totalCgstPaise = 0
      let totalSgstPaise = 0
      let totalIgstPaise = 0
      const processedItems: SaleLineItem[] = []

      for (const item of input.items) {
        const product = productDocs[item.productId]!
        const lineGrossPaise = Math.round((item.quantity * item.unitPricePaise) / 1000)

        // Line discount
        const discPercent = item.discountPercent || 0
        const percentDiscountPaise = Math.round((lineGrossPaise * discPercent) / 100)
        const itemDiscountPaise = percentDiscountPaise + (item.discountPaise || 0)
        const netLineGrossPaise = Math.max(0, lineGrossPaise - itemDiscountPaise)

        // Tax split
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
          unitPricePaise: item.unitPricePaise,
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

      // Round-off to nearest Rupee (Paise scale: multiples of 100)
      const roundedTotalPaise = Math.round(rawNetTotalPaise / 100) * 100
      const roundOffPaise = roundedTotalPaise - rawNetTotalPaise

      // Payments & Allocation
      const initialPaidPaise = input.payment ? Math.min(input.payment.amountPaise, roundedTotalPaise) : 0
      const balanceDuePaise = roundedTotalPaise - initialPaidPaise
      const paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
        balanceDuePaise === 0 ? 'PAID' : initialPaidPaise > 0 ? 'PARTIAL' : 'UNPAID'

      const invoiceRef = db.collection(`organizations/${orgId}/salesInvoices`).doc()
      const invoiceId = invoiceRef.id

      const invoiceData: SaleInvoice = {
        transactionId: invoiceId,
        organizationId: orgId,
        financialPeriodId: periodId,
        documentType: docType,
        documentNumber: invoiceNumber,
        transactionDate: invoiceDate,
        postingDate: now,
        status: 'POSTED',
        locationId,
        warehouseId,
        partyId: input.partyId,
        partyName: input.partyName,
        partyPhone: input.partyPhone,
        partyGstin: input.partyGstin,
        partyStateCode: input.partyStateCode,
        billingAddress: input.billingAddress,
        shippingAddress: input.shippingAddress,
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
        isPosSale: isPos,
        notes: input.notes,
        termsAndConditions: input.termsAndConditions,
        createdBy: actor.uid,
        createdAt: now,
        updatedAt: now,
      }

      // Execute authoritative posting
      return await SalesService.postSalesInvoiceInTransaction(
        txn,
        orgId,
        periodId,
        invoiceRef,
        invoiceData,
        allowNegativeStock,
        actor,
        input.payment
      )
    })
  }

  /**
   * Retrieves paginated sales invoices with filters.
   */
  static async getInvoices(
    orgId: string,
    options: {
      documentType?: string;
      partyId?: string;
      startDate?: string;
      endDate?: string;
      paymentStatus?: string;
      search?: string;
      limit?: number;
    }
  ): Promise<SaleInvoice[]> {
    let query: FirebaseFirestore.Query = db.collection(`organizations/${orgId}/salesInvoices`)

    if (options.documentType) {
      query = query.where('documentType', '==', options.documentType)
    }
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
    return snap.docs.map((d) => d.data() as SaleInvoice)
  }

  /**
   * Retrieves single invoice by ID.
   */
  static async getInvoiceById(orgId: string, invoiceId: string): Promise<SaleInvoice | null> {
    const doc = await db.collection(`organizations/${orgId}/salesInvoices`).doc(invoiceId).get()
    if (!doc.exists) return null
    return doc.data() as SaleInvoice
  }
}
