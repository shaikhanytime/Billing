import { db } from '../../config/firebase-admin'
import {
  Quotation,
  QuotationLineItem,
  QuotationStatus,
  SaleInvoice,
  SaleLineItem,
  StockBalance,
  StockMovement,
  PartyLedgerEntry,
  Product,
  UnitConversion,
} from '../../types/domain.types'
import { SequenceService } from '../sequence/sequence.service'
import { PeriodService } from '../periods/period.service'
import { TaxEngine } from '../tax/tax.engine'
import { AuditService } from '../audit/audit.service'
import { UnitsService } from '../units/units.service'
import { SalesService } from '../sales/sales.service'

export interface CreateQuotationItemInput {
  productId: string;
  enteredQuantity: number;       // Scaled units (e.g. 1000 = 1.000)
  enteredUnit?: string;          // e.g. "BOX" or "PCS"
  conversionNumerator?: number;  // e.g. 24
  conversionDenominator?: number;// default 1
  unitPricePaise?: number;       // Quoted price per entered unit in Paise
  isTaxInclusive?: boolean;
  discountPercent?: number;      // e.g. 5 for 5%
  discountPaise?: number;
  taxRate: 0 | 5 | 12 | 18 | 28;
}

export interface CreateQuotationInput {
  quotationDate: string;         // ISO YYYY-MM-DD
  validUntil?: string;           // ISO YYYY-MM-DD
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
  warehouseId?: string;
  locationId?: string;
  items: CreateQuotationItemInput[];
  discountPaise?: number;
  additionalChargesPaise?: number;
  notes?: string;
  termsAndConditions?: string;
  status?: QuotationStatus;
}

export class QuotationsService {
  /**
   * Deterministically creates a commercial Quotation / Estimate.
   * STRICT NON-POSTING: Does NOT mutate StockBalance, StockMovement, PartyLedger, or Party Balance.
   */
  static async createQuotation(
    orgId: string,
    input: CreateQuotationInput,
    actor: { uid: string; email?: string }
  ): Promise<Quotation> {
    const locationId = input.locationId || 'DEFAULT'
    const warehouseId = input.warehouseId || 'MAIN'
    const now = new Date().toISOString()
    const quotationDate = input.quotationDate || now.slice(0, 10)
    const validUntil =
      input.validUntil ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) // default 30 days validity

    // 1. Fetch Organization settings for state code
    const orgDoc = await db.collection('organizations').doc(orgId).get()
    if (!orgDoc.exists) throw new Error('Organization not found.')
    const orgData = orgDoc.data() || {}
    const companyStateCode = orgData.stateCode || orgData.gstin?.slice(0, 2) || '27'

    // 2. Validate Financial Period
    const periodId = await PeriodService.assertPeriodOpen(orgId, quotationDate)

    return await db.runTransaction(async (txn) => {
      // Allocate authoritative sequence EST-XXXXX
      const quotationNumber = await SequenceService.allocateInTransaction(
        txn,
        orgId,
        periodId,
        'QUOTATION',
        'EST-'
      )

      // Fetch products & unit conversion rules
      const productDocs: { [id: string]: Product } = {}
      for (const item of input.items) {
        if (!productDocs[item.productId]) {
          const pRef = db.collection(`organizations/${orgId}/products`).doc(item.productId)
          const pSnap = await txn.get(pRef)
          if (!pSnap.exists) throw new Error(`Product ${item.productId} not found.`)
          productDocs[item.productId] = pSnap.data() as Product
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

      // Calculate Line Items with exact Alternate Unit & Paise math
      let totalTaxablePaise = 0
      let totalCgstPaise = 0
      let totalSgstPaise = 0
      let totalIgstPaise = 0
      const processedItems: QuotationLineItem[] = []

      for (const item of input.items) {
        const product = productDocs[item.productId]!
        const baseUnit = product.baseUnitSymbol || 'PCS'
        const enteredUnit = (item.enteredUnit || baseUnit).toUpperCase().trim()

        let num = item.conversionNumerator || 1
        let den = item.conversionDenominator || 1

        if (enteredUnit !== baseUnit.toUpperCase()) {
          // If product has defined secondary unit
          if (product.secondaryUnitSymbol?.toUpperCase() === enteredUnit) {
            num = product.conversionNumerator || num
            den = product.conversionDenominator || den
          }
        }

        // Calculate canonical base quantity in scaled base units
        const baseQuantity = UnitsService.toBaseQuantity(item.enteredQuantity, num, den)

        // Resolve unit price:
        // 1. Explicit unitPricePaise in item
        // 2. Explicit package price on conversion rule / product
        // 3. Derived price from base unit sale price
        let effectiveUnitPricePaise = item.unitPricePaise
        if (effectiveUnitPricePaise === undefined || effectiveUnitPricePaise === null) {
          if (enteredUnit === baseUnit.toUpperCase()) {
            effectiveUnitPricePaise = product.salePrice
          } else {
            effectiveUnitPricePaise = UnitsService.toPackagedPricePaise(product.salePrice, num, den)
          }
        }

        // Gross Line calculation: (enteredQuantityScaled * effectiveUnitPricePaise) / 1000
        const lineGrossPaise = Math.round((item.enteredQuantity * effectiveUnitPricePaise) / 1000)

        // Line discount
        const discPercent = item.discountPercent || 0
        const percentDiscountPaise = Math.round((lineGrossPaise * discPercent) / 100)
        const itemDiscountPaise = percentDiscountPaise + (item.discountPaise || 0)
        const netLineGrossPaise = Math.max(0, lineGrossPaise - itemDiscountPaise)

        // Tax calculation
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
          id: `quote_item_${processedItems.length + 1}`,
          productId: item.productId,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          hsnCode: product.hsnCode || 'N/A',
          enteredQuantity: item.enteredQuantity,
          enteredUnit,
          conversionNumerator: num,
          conversionDenominator: den,
          baseQuantity,
          unitPricePaise: effectiveUnitPricePaise,
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

      const quoteDiscountPaise = input.discountPaise || 0
      const additionalChargesPaise = input.additionalChargesPaise || 0
      const rawNetTotalPaise =
        totalTaxablePaise +
        totalCgstPaise +
        totalSgstPaise +
        totalIgstPaise -
        quoteDiscountPaise +
        additionalChargesPaise

      const roundedTotalPaise = Math.round(rawNetTotalPaise / 100) * 100
      const roundOffPaise = roundedTotalPaise - rawNetTotalPaise

      const quoteRef = db.collection(`organizations/${orgId}/quotations`).doc()
      const quoteId = quoteRef.id

      const initialStatus: QuotationStatus = input.status || 'DRAFT'

      const quotationData: Quotation = {
        id: quoteId,
        organizationId: orgId,
        financialPeriodId: periodId,
        documentType: 'QUOTATION',
        documentNumber: quotationNumber,
        quotationStatus: initialStatus,
        quotationDate,
        validUntil,
        partyId: input.partyId,
        partyName: input.partyName,
        partyPhone: input.partyPhone,
        partyGstin: input.partyGstin,
        partyStateCode: input.partyStateCode,
        billingAddress: input.billingAddress,
        shippingAddress: input.shippingAddress,
        placeOfSupply: input.placeOfSupply,
        warehouseId,
        locationId,
        items: processedItems,
        subtotalPaise: totalTaxablePaise,
        taxableAmountPaise: totalTaxablePaise,
        cgstAmountPaise: totalCgstPaise,
        sgstAmountPaise: totalSgstPaise,
        igstAmountPaise: totalIgstPaise,
        totalTaxPaise: totalCgstPaise + totalSgstPaise + totalIgstPaise,
        discountPaise: quoteDiscountPaise,
        additionalChargesPaise,
        roundOffPaise,
        totalAmountPaise: roundedTotalPaise,
        notes: input.notes,
        termsAndConditions: input.termsAndConditions,
        createdBy: actor.uid,
        createdAt: now,
        updatedAt: now,
      }

      // Write Quotation Doc (STRICTLY NON-POSTING: No stock or ledger writes)
      txn.set(quoteRef, quotationData)

      // Audit Log inside transaction
      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'CREATE',
        entityType: 'QUOTATION',
        entityId: quoteId,
        entityNumber: quotationNumber,
        diff: {
          after: {
            quotationNumber,
            totalAmountPaise: roundedTotalPaise,
            quotationStatus: initialStatus,
            itemsCount: processedItems.length,
          },
        },
      })

      return quotationData
    })
  }

  /**
   * Retrieves paginated quotations with filters.
   */
  static async getQuotations(
    orgId: string,
    options: {
      status?: QuotationStatus;
      partyId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      limit?: number;
    }
  ): Promise<Quotation[]> {
    let query: FirebaseFirestore.Query = db.collection(`organizations/${orgId}/quotations`)

    if (options.status) {
      query = query.where('quotationStatus', '==', options.status)
    }
    if (options.partyId) {
      query = query.where('partyId', '==', options.partyId)
    }
    if (options.startDate) {
      query = query.where('quotationDate', '>=', options.startDate)
    }
    if (options.endDate) {
      query = query.where('quotationDate', '<=', options.endDate)
    }

    query = query.orderBy('quotationDate', 'desc').limit(options.limit || 50)
    const snap = await query.get()
    let results = snap.docs.map((d) => d.data() as Quotation)

    if (options.search) {
      const q = options.search.toLowerCase().trim()
      results = results.filter(
        (r) =>
          r.documentNumber.toLowerCase().includes(q) ||
          r.partyName.toLowerCase().includes(q)
      )
    }

    return results
  }

  /**
   * Retrieves single quotation by ID.
   */
  static async getQuotationById(orgId: string, quotationId: string): Promise<Quotation | null> {
    const doc = await db.collection(`organizations/${orgId}/quotations`).doc(quotationId).get()
    if (!doc.exists) return null
    return doc.data() as Quotation
  }

  /**
   * Updates quotation lifecycle status server-authoritatively.
   * Allowed transitions:
   * DRAFT -> SENT | DECLINED
   * SENT -> ACCEPTED | DECLINED | EXPIRED
   * ACCEPTED -> DECLINED (Conversion to CONVERTED is handled by convertQuotationToInvoice)
   */
  static async updateQuotationStatus(
    orgId: string,
    quotationId: string,
    newStatus: QuotationStatus,
    actor: { uid: string; email?: string }
  ): Promise<Quotation> {
    const now = new Date().toISOString()
    const quoteRef = db.collection(`organizations/${orgId}/quotations`).doc(quotationId)

    return await db.runTransaction(async (txn) => {
      const snap = await txn.get(quoteRef)
      if (!snap.exists) throw new Error('Quotation not found.')

      const quote = snap.data() as Quotation
      const current = quote.quotationStatus

      if (current === 'CONVERTED') {
        throw new Error('Converted quotation is immutable and cannot change status.')
      }
      if (current === 'DECLINED' || current === 'EXPIRED') {
        throw new Error(`Quotation is ${current} and cannot transition to ${newStatus}.`)
      }

      // Validate allowed transitions
      const valid =
        (current === 'DRAFT' && (newStatus === 'SENT' || newStatus === 'DECLINED')) ||
        (current === 'SENT' && (newStatus === 'ACCEPTED' || newStatus === 'DECLINED' || newStatus === 'EXPIRED')) ||
        (current === 'ACCEPTED' && newStatus === 'DECLINED')

      if (!valid) {
        throw new Error(`Invalid status transition from "${current}" to "${newStatus}".`)
      }

      txn.update(quoteRef, {
        quotationStatus: newStatus,
        updatedAt: now,
      })

      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'UPDATE',
        entityType: 'QUOTATION',
        entityId: quotationId,
        entityNumber: quote.documentNumber,
        diff: {
          before: { quotationStatus: current },
          after: { quotationStatus: newStatus },
        },
      })

      return {
        ...quote,
        quotationStatus: newStatus,
        updatedAt: now,
      }
    })
  }

  /**
   * ATOMIC QUOTATION → TAX INVOICE CONVERSION
   *
   * 1. Load quotation & assert ownership.
   * 2. Assert convertible (not already CONVERTED, DECLINED, or EXPIRED).
   * 3. Assert quotation validity date has not passed (validUntil >= invoiceDate).
   * 4. Assert fiscal period is OPEN.
   * 5. Generate authoritative Sales Invoice sequence.
   * 6. Construct posted Sales Invoice from immutable quotation snapshot.
   * 7. Execute authoritative Sales Posting (inventory deduction, WAC COGS, party ledger posting, invoice doc write, and audit logging).
   * 8. Mark quotation CONVERTED with convertedToInvoiceId and convertedAt.
   * 9. Commit atomically.
   */
  static async convertQuotationToInvoice(
    orgId: string,
    quotationId: string,
    actor: { uid: string; email?: string }
  ): Promise<{ invoice: SaleInvoice; quotation: Quotation }> {
    const now = new Date().toISOString()
    const invoiceDate = now.slice(0, 10)

    // 1. Fetch Organization settings for negative stock policy
    const orgDoc = await db.collection('organizations').doc(orgId).get()
    if (!orgDoc.exists) throw new Error('Organization not found.')
    const orgData = orgDoc.data() || {}
    const allowNegativeStock = orgData.settings?.allowNegativeStock === true

    // 2. Validate Financial Period for invoice date
    const periodId = await PeriodService.assertPeriodOpen(orgId, invoiceDate)

    const quoteRef = db.collection(`organizations/${orgId}/quotations`).doc(quotationId)

    return await db.runTransaction(async (txn) => {
      const quoteSnap = await txn.get(quoteRef)
      if (!quoteSnap.exists) throw new Error('Quotation not found.')

      const quote = quoteSnap.data() as Quotation

      // Organization isolation
      if (quote.organizationId !== orgId) {
        throw new Error('Unauthorized quotation access.')
      }

      // Idempotency / Duplicate conversion check
      if (quote.quotationStatus === 'CONVERTED' || quote.convertedToInvoiceId) {
        throw new Error(
          `Quotation ${quote.documentNumber} has already been converted to Tax Invoice #${quote.convertedToInvoiceId}.`
        )
      }

      if (quote.quotationStatus === 'DECLINED' || quote.quotationStatus === 'EXPIRED') {
        throw new Error(`Cannot convert a quotation in "${quote.quotationStatus}" status.`)
      }

      // Enforce validUntil date limit
      if (quote.validUntil && quote.validUntil < invoiceDate) {
        throw new Error(
          `Quotation ${quote.documentNumber} expired on ${quote.validUntil} and cannot be converted.`
        )
      }

      const locationId = quote.locationId || 'DEFAULT'
      const warehouseId = quote.warehouseId || 'MAIN'

      // Allocate authoritative Invoice Number (INV-XXXXX)
      const invoiceNumber = await SequenceService.allocateInTransaction(
        txn,
        orgId,
        periodId,
        'SALE_INVOICE',
        'INV-'
      )

      const invoiceRef = db.collection(`organizations/${orgId}/salesInvoices`).doc()
      const invoiceId = invoiceRef.id

      // Build Invoice Line Items using IMMUTABLE QUOTATION COMMERCIAL SNAPSHOT
      const invoiceLineItems: SaleLineItem[] = quote.items.map((item, index) => {
        return {
          id: `item_${index + 1}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode,
          hsnCode: item.hsnCode,
          unit: item.enteredUnit || 'PCS',
          quantity: item.baseQuantity, // Canonical base units for inventory tracking
          unitPricePaise: item.unitPricePaise,
          isTaxInclusive: item.isTaxInclusive,
          discountPercent: item.discountPercent,
          discountPaise: item.discountPaise,
          taxRate: item.taxRate,
          taxablePaise: item.taxablePaise,
          cgstPaise: item.cgstPaise,
          sgstPaise: item.sgstPaise,
          igstPaise: item.igstPaise,
          totalTaxPaise: item.totalTaxPaise,
          totalPaise: item.totalPaise,
        }
      })

      const invoiceData: SaleInvoice = {
        transactionId: invoiceId,
        organizationId: orgId,
        financialPeriodId: periodId,
        documentType: 'SALE_INVOICE',
        documentNumber: invoiceNumber,
        transactionDate: invoiceDate,
        postingDate: now,
        status: 'POSTED',
        locationId,
        warehouseId,
        partyId: quote.partyId,
        partyName: quote.partyName,
        partyPhone: quote.partyPhone,
        partyGstin: quote.partyGstin,
        partyStateCode: quote.partyStateCode,
        billingAddress: quote.billingAddress,
        shippingAddress: quote.shippingAddress,
        placeOfSupply: quote.placeOfSupply,
        dueDate: invoiceDate,
        items: invoiceLineItems,
        subtotalPaise: quote.subtotalPaise,
        taxableAmountPaise: quote.taxableAmountPaise,
        cgstAmountPaise: quote.cgstAmountPaise,
        sgstAmountPaise: quote.sgstAmountPaise,
        igstAmountPaise: quote.igstAmountPaise,
        totalTaxPaise: quote.totalTaxPaise,
        discountPaise: quote.discountPaise,
        additionalChargesPaise: quote.additionalChargesPaise,
        roundOffPaise: quote.roundOffPaise,
        totalAmountPaise: quote.totalAmountPaise,
        paidAmountPaise: 0,
        balanceDuePaise: quote.totalAmountPaise,
        paymentStatus: 'UNPAID',
        isPosSale: false,
        notes: quote.notes ? `Converted from Quotation #${quote.documentNumber}. ${quote.notes}` : `Converted from Quotation #${quote.documentNumber}.`,
        termsAndConditions: quote.termsAndConditions,
        createdBy: actor.uid,
        createdAt: now,
        updatedAt: now,
      }

      // Reusable authoritative sales posting engine (stock reduction, WAC movements, ledger debit, invoice doc)
      await SalesService.postSalesInvoiceInTransaction(
        txn,
        orgId,
        periodId,
        invoiceRef,
        invoiceData,
        allowNegativeStock,
        actor
      )

      // Mark Quotation as CONVERTED
      const updatedQuotation: Quotation = {
        ...quote,
        quotationStatus: 'CONVERTED',
        convertedToInvoiceId: invoiceId,
        convertedAt: now,
        updatedAt: now,
      }

      txn.update(quoteRef, {
        quotationStatus: 'CONVERTED',
        convertedToInvoiceId: invoiceId,
        convertedAt: now,
        updatedAt: now,
      })

      // Audit Log for Quotation Conversion
      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'UPDATE',
        entityType: 'QUOTATION',
        entityId: quotationId,
        entityNumber: quote.documentNumber,
        diff: {
          before: { quotationStatus: quote.quotationStatus },
          after: { quotationStatus: 'CONVERTED', convertedToInvoiceId: invoiceId },
        },
      })

      return {
        invoice: invoiceData,
        quotation: updatedQuotation,
      }
    })
  }
}
