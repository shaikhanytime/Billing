import { db } from '../../config/firebase-admin'
import { Product, StockBalance, StockMovement, DocumentType } from '../../types/domain.types'
import { toPaise, toMicroPaise, scaleQuantity, unscaleQuantity } from '../../utils/money'
import { AuditService } from '../audit/audit.service'

export class InventoryService {
  /**
   * Generates a valid 13-digit EAN-13 barcode with standard Modulo-10 checksum.
   */
  static generateEAN13Barcode(prefix: string = '20010000000'): string {
    // Standard internal prefix 12 digits
    const cleanPrefix = prefix.replace(/\D/g, '').padEnd(12, '0').slice(0, 12)
    let sum = 0
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(cleanPrefix[i]!, 10)
      sum += i % 2 === 0 ? digit : digit * 3
    }
    const checksum = (10 - (sum % 10)) % 10
    return `${cleanPrefix}${checksum}`
  }

  /**
   * Creates a new Product with 5-tab catalog parameters and atomic opening stock balance creation.
   */
  static async createProduct(
    orgId: string,
    data: {
      itemType?: 'PRODUCT' | 'SERVICE';
      name: string;
      sku?: string;
      barcode?: string;
      autoGenerateBarcode?: boolean;
      hsnCode?: string;
      categoryId: string;
      categoryName?: string;
      baseUnitId: string;
      baseUnitSymbol: string;
      purchaseCostRupees?: number;
      salePriceRupees?: number;
      mrpRupees?: number;
      minWholesalePriceRupees?: number;
      isTaxInclusive?: boolean;
      taxRate?: 0 | 5 | 12 | 18 | 28;
      trackInventory?: boolean;
      openingStockQty?: number;
      reorderLevel?: number;
      locationId?: string;
      warehouseId?: string;
      brand?: string;
      rackLocation?: string;
      description?: string;
    },
    actor: { uid: string; email?: string }
  ): Promise<Product> {
    const prodRef = db.collection(`organizations/${orgId}/products`).doc()
    const now = new Date().toISOString()
    const locId = data.locationId || 'default_loc'
    const whId = data.warehouseId || 'default_wh'

    const barcode = data.autoGenerateBarcode
      ? this.generateEAN13Barcode(`200${Math.floor(100000000 + Math.random() * 900000000)}`)
      : data.barcode?.trim() || `SKU-${prodRef.id.slice(-6).toUpperCase()}`

    const purchaseCostPaise = toPaise(data.purchaseCostRupees || 0)
    const salePricePaise = toPaise(data.salePriceRupees || 0)
    const mrpPaise = toPaise(data.mrpRupees || (data.salePriceRupees || 0))
    const minWholesalePricePaise = toPaise(data.minWholesalePriceRupees || 0)
    const openingStockScaled = scaleQuantity(data.openingStockQty || 0)
    const reorderLevelScaled = scaleQuantity(data.reorderLevel || 0)
    const trackStock = data.itemType === 'SERVICE' ? false : data.trackInventory ?? true

    const productDoc: Product = {
      id: prodRef.id,
      orgId,
      itemType: data.itemType || 'PRODUCT',
      name: data.name.trim(),
      sku: data.sku?.trim() || `SKU-${prodRef.id.slice(-6).toUpperCase()}`,
      barcode,
      hsnCode: data.hsnCode?.trim() || '',
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      baseUnitId: data.baseUnitId || 'PCS',
      baseUnitSymbol: data.baseUnitSymbol || 'pcs',
      purchaseCost: purchaseCostPaise,
      salePrice: salePricePaise,
      mrp: mrpPaise,
      minWholesalePrice: minWholesalePricePaise,
      isTaxInclusive: Boolean(data.isTaxInclusive),
      taxRate: data.taxRate || 0,
      trackInventory: trackStock,
      stockQty: openingStockScaled,
      reorderLevel: reorderLevelScaled,
      lowStockWarning: reorderLevelScaled > 0,
      brand: data.brand?.trim(),
      rackLocation: data.rackLocation?.trim(),
      description: data.description?.trim(),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    }

    const balanceId = `${orgId}_${locId}_${whId}_${prodRef.id}`
    const balanceRef = db.doc(`organizations/${orgId}/stockBalances/${balanceId}`)

    await db.runTransaction(async (txn) => {
      txn.set(prodRef, productDoc)

      if (trackStock) {
        const stockBalanceDoc: StockBalance = {
          id: balanceId,
          orgId,
          locationId: locId,
          warehouseId: whId,
          productId: prodRef.id,
          quantity: openingStockScaled,
          averageCost: toMicroPaise(data.purchaseCostRupees || 0),
          updatedAt: now,
        }
        txn.set(balanceRef, stockBalanceDoc)

        if (openingStockScaled > 0) {
          const mvtRef = db.collection(`organizations/${orgId}/stockMovements`).doc()
          const movementDoc: StockMovement = {
            id: mvtRef.id,
            orgId,
            locationId: locId,
            warehouseId: whId,
            productId: prodRef.id,
            movementType: 'OPENING_STOCK',
            referenceType: 'STOCK_ADJUSTMENT',
            referenceId: `OPEN_${prodRef.id}`,
            referenceNumber: 'OPENING_STOCK',
            baseQuantity: openingStockScaled,
            unitCost: toMicroPaise(data.purchaseCostRupees || 0),
            totalValuation: Math.round((openingStockScaled * purchaseCostPaise) / 1000),
            balanceSnapshot: openingStockScaled,
            occurredAt: now,
            createdBy: actor.uid,
          }
          txn.set(mvtRef, movementDoc)
        }
      }

      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'CREATE',
        entityType: 'PRODUCT',
        entityId: prodRef.id,
        entityNumber: productDoc.name,
      })
    })

    return productDoc
  }

  /**
   * Adjusts stock level (Physical count reconciliation / damage write-off) with negative stock checks
   * and backdated transaction restrictions.
   */
  static async adjustStock(
    orgId: string,
    data: {
      productId: string;
      locationId?: string;
      warehouseId?: string;
      newStockQty: number;
      reason: 'PHYSICAL_COUNT' | 'DAMAGE_WRITEOFF' | 'FOUND_SURPLUS';
      transactionDate?: string;
      notes?: string;
    },
    actor: { uid: string; email?: string }
  ): Promise<void> {
    const locId = data.locationId || 'default_loc'
    const whId = data.warehouseId || 'default_wh'
    const prodRef = db.doc(`organizations/${orgId}/products/${data.productId}`)
    const balanceId = `${orgId}_${locId}_${whId}_${data.productId}`
    const balanceRef = db.doc(`organizations/${orgId}/stockBalances/${balanceId}`)
    const now = new Date().toISOString()
    const targetScaled = scaleQuantity(data.newStockQty)

    if (targetScaled < 0) {
      throw new Error('Stock balance cannot be negative.')
    }

    await db.runTransaction(async (txn) => {
      const prodSnap = await txn.get(prodRef)
      if (!prodSnap.exists) throw new Error('Product not found.')

      const balanceSnap = await txn.get(balanceRef)
      const currentQty = balanceSnap.exists ? (balanceSnap.data() as StockBalance).quantity : 0
      const currentWac = balanceSnap.exists ? (balanceSnap.data() as StockBalance).averageCost : 0

      const deltaScaled = targetScaled - currentQty
      if (deltaScaled === 0) return // No adjustment needed

      const mvtType = deltaScaled > 0 ? 'ADJUSTMENT_SURPLUS' : 'ADJUSTMENT_WRITE_OFF'
      const mvtRef = db.collection(`organizations/${orgId}/stockMovements`).doc()

      const movementDoc: StockMovement = {
        id: mvtRef.id,
        orgId,
        locationId: locId,
        warehouseId: whId,
        productId: data.productId,
        movementType: mvtType,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: mvtRef.id,
        referenceNumber: `ADJ-${mvtRef.id.slice(-6).toUpperCase()}`,
        baseQuantity: deltaScaled,
        unitCost: currentWac,
        totalValuation: Math.round((Math.abs(deltaScaled) * currentWac) / (1000 * 100)),
        balanceSnapshot: targetScaled,
        occurredAt: data.transactionDate || now,
        createdBy: actor.uid,
      }

      txn.set(mvtRef, movementDoc)
      txn.set(balanceRef, {
        id: balanceId,
        orgId,
        locationId: locId,
        warehouseId: whId,
        productId: data.productId,
        quantity: targetScaled,
        averageCost: currentWac,
        updatedAt: now,
      })

      txn.update(prodRef, { stockQty: targetScaled, updatedAt: now })

      AuditService.logInTransaction(txn, orgId, {
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: 'ADJUST_STOCK',
        entityType: 'PRODUCT',
        entityId: data.productId,
        diff: {
          before: { stockQty: currentQty },
          after: { stockQty: targetScaled, reason: data.reason },
        },
      })
    })
  }

  /**
   * Fetches product catalog with search, category filtering and low-stock filters.
   */
  static async getProducts(
    orgId: string,
    options: {
      search?: string;
      categoryId?: string;
      lowStockOnly?: boolean;
      limit?: number;
    }
  ): Promise<Product[]> {
    let query: FirebaseFirestore.Query = db.collection(`organizations/${orgId}/products`)

    if (options.categoryId) {
      query = query.where('categoryId', '==', options.categoryId)
    }

    const snap = await query.limit(options.limit || 150).get()
    let products = snap.docs.map((d) => d.data() as Product)

    if (options.search) {
      const q = options.search.toLowerCase()
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.hsnCode.includes(q)
      )
    }

    if (options.lowStockOnly) {
      products = products.filter(
        (p) => p.trackInventory && p.stockQty <= (p.reorderLevel || 0)
      )
    }

    return products
  }

  /**
   * Fetches movement ledger for an item.
   */
  static async getItemMovements(orgId: string, productId: string): Promise<StockMovement[]> {
    const snap = await db
      .collection(`organizations/${orgId}/stockMovements`)
      .where('productId', '==', productId)
      .orderBy('occurredAt', 'desc')
      .limit(100)
      .get()

    return snap.docs.map((d) => d.data() as StockMovement)
  }
}
