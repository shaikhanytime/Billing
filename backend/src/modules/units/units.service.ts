import { db } from '../../config/firebase-admin'
import { UnitConversion, Product } from '../../types/domain.types'
import { AuditService } from '../audit/audit.service'

export interface CreateUnitConversionInput {
  productId?: string;
  fromUnit: string;              // e.g. "BOX"
  toBaseUnit: string;            // e.g. "PCS"
  conversionNumerator: number;   // e.g. 24
  conversionDenominator?: number;// default 1
  barcode?: string;
  salePricePaise?: number;
  purchaseCostPaise?: number;
}

export class UnitsService {
  /**
   * Deterministically converts entered secondary quantity into canonical Scaled Base Units.
   * Scaled base units are integers scaled by 1,000.
   */
  static toBaseQuantity(
    enteredQtyScaled: number,
    numerator: number = 1,
    denominator: number = 1
  ): number {
    if (numerator <= 0 || denominator <= 0) {
      throw new Error('Conversion numerator and denominator must be positive integers.')
    }
    return Math.round((enteredQtyScaled * numerator) / denominator)
  }

  /**
   * Deterministically converts canonical Scaled Base Units into secondary quantity.
   */
  static toSecondaryQuantity(
    baseQtyScaled: number,
    numerator: number = 1,
    denominator: number = 1
  ): number {
    if (numerator <= 0 || denominator <= 0) {
      throw new Error('Conversion numerator and denominator must be positive integers.')
    }
    return Math.round((baseQtyScaled * denominator) / numerator)
  }

  /**
   * Deterministically converts base unit selling price (in Paise) into packaged unit price.
   * e.g. ₹10.00 / PCS * 24 = ₹240.00 / BOX
   */
  static toPackagedPricePaise(
    basePricePaise: number,
    numerator: number = 1,
    denominator: number = 1
  ): number {
    if (numerator <= 0 || denominator <= 0) {
      throw new Error('Conversion numerator and denominator must be positive integers.')
    }
    return Math.round((basePricePaise * numerator) / denominator)
  }

  /**
   * Deterministically converts packaged selling price (in Paise) into base unit price.
   */
  static toBasePricePaise(
    packagedPricePaise: number,
    numerator: number = 1,
    denominator: number = 1
  ): number {
    if (numerator <= 0 || denominator <= 0) {
      throw new Error('Conversion numerator and denominator must be positive integers.')
    }
    return Math.round((packagedPricePaise * denominator) / numerator)
  }

  /**
   * Creates or updates a unit conversion rule.
   */
  static async createRule(
    orgId: string,
    input: CreateUnitConversionInput,
    actor: { uid: string; email?: string }
  ): Promise<UnitConversion> {
    const num = Math.round(input.conversionNumerator)
    const den = Math.round(input.conversionDenominator || 1)
    if (num <= 0 || den <= 0) {
      throw new Error('Conversion ratios must be positive integers.')
    }

    const now = new Date().toISOString()
    const ruleId = `${input.productId || 'GLOBAL'}_${input.fromUnit.toUpperCase().trim()}`
    const ruleRef = db.collection(`organizations/${orgId}/unitConversions`).doc(ruleId)

    const ruleData: UnitConversion = {
      id: ruleId,
      orgId,
      productId: input.productId,
      fromUnit: input.fromUnit.toUpperCase().trim(),
      toBaseUnit: input.toBaseUnit.toUpperCase().trim(),
      conversionNumerator: num,
      conversionDenominator: den,
      multiplier: num / den,
      barcode: input.barcode?.trim() || undefined,
      salePricePaise: input.salePricePaise,
      purchaseCostPaise: input.purchaseCostPaise,
      createdAt: now,
      updatedAt: now,
    }

    await db.runTransaction(async (txn) => {
      txn.set(ruleRef, ruleData, { merge: true })

      // If attached to a product, sync secondary unit metadata onto product doc
      if (input.productId) {
        const prodRef = db.collection(`organizations/${orgId}/products`).doc(input.productId)
        txn.update(prodRef, {
          secondaryUnitSymbol: ruleData.fromUnit,
          conversionNumerator: num,
          conversionDenominator: den,
          secondaryBarcode: ruleData.barcode || null,
          updatedAt: now,
        })
      }

      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'CREATE',
        entityType: 'SETTINGS',
        entityId: ruleId,
        diff: { after: ruleData },
      })
    })

    return ruleData
  }

  /**
   * Fetches conversion rules for organization or specific product.
   */
  static async getRules(orgId: string, productId?: string): Promise<UnitConversion[]> {
    let query: FirebaseFirestore.Query = db.collection(`organizations/${orgId}/unitConversions`)
    if (productId) {
      query = query.where('productId', 'in', [productId, null])
    }
    const snap = await query.get()
    return snap.docs.map((d) => d.data() as UnitConversion)
  }

  /**
   * Resolves product and unit multiplier by primary or secondary barcode.
   */
  static async resolveByBarcode(
    orgId: string,
    scannedBarcode: string
  ): Promise<{
    product: Product;
    isSecondaryUnit: boolean;
    unitSymbol: string;
    numerator: number;
    denominator: number;
    effectivePricePaise: number;
  } | null> {
    const trimmed = scannedBarcode.trim()

    // 1. Direct barcode match on primary product
    const primarySnap = await db
      .collection(`organizations/${orgId}/products`)
      .where('barcode', '==', trimmed)
      .limit(1)
      .get()

    if (!primarySnap.empty) {
      const prod = primarySnap.docs[0]!.data() as Product
      return {
        product: prod,
        isSecondaryUnit: false,
        unitSymbol: prod.baseUnitSymbol,
        numerator: 1,
        denominator: 1,
        effectivePricePaise: prod.salePrice,
      }
    }

    // 2. Secondary barcode match on product
    const secProdSnap = await db
      .collection(`organizations/${orgId}/products`)
      .where('secondaryBarcode', '==', trimmed)
      .limit(1)
      .get()

    if (!secProdSnap.empty) {
      const prod = secProdSnap.docs[0]!.data() as Product
      const num = prod.conversionNumerator || 1
      const den = prod.conversionDenominator || 1
      const pkgPrice = this.toPackagedPricePaise(prod.salePrice, num, den)

      return {
        product: prod,
        isSecondaryUnit: true,
        unitSymbol: prod.secondaryUnitSymbol || 'PACK',
        numerator: num,
        denominator: den,
        effectivePricePaise: pkgPrice,
      }
    }

    // 3. Unit conversions table barcode match
    const convSnap = await db
      .collection(`organizations/${orgId}/unitConversions`)
      .where('barcode', '==', trimmed)
      .limit(1)
      .get()

    if (!convSnap.empty) {
      const rule = convSnap.docs[0]!.data() as UnitConversion
      if (rule.productId) {
        const pDoc = await db.collection(`organizations/${orgId}/products`).doc(rule.productId).get()
        if (pDoc.exists) {
          const prod = pDoc.data() as Product
          const pkgPrice = rule.salePricePaise || this.toPackagedPricePaise(prod.salePrice, rule.conversionNumerator, rule.conversionDenominator)
          return {
            product: prod,
            isSecondaryUnit: true,
            unitSymbol: rule.fromUnit,
            numerator: rule.conversionNumerator,
            denominator: rule.conversionDenominator,
            effectivePricePaise: pkgPrice,
          }
        }
      }
    }

    return null
  }
}
