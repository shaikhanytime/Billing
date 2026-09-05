import { Router, Response } from 'express'
import { z } from 'zod'
import { InventoryService } from './inventory.service'
import { authenticate, requireRole } from '../../middleware/auth.middleware'
import { AuthenticatedRequest } from '../../middleware/idempotency.middleware'

const router = Router()

const createProductSchema = z.object({
  itemType: z.enum(['PRODUCT', 'SERVICE']).optional(),
  name: z.string().min(1, 'Item name is required'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  autoGenerateBarcode: z.boolean().optional(),
  hsnCode: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  categoryName: z.string().optional(),
  baseUnitId: z.string().min(1, 'Base unit is required'),
  baseUnitSymbol: z.string().min(1, 'Base unit symbol is required'),
  purchaseCostRupees: z.number().nonnegative().optional(),
  salePriceRupees: z.number().nonnegative().optional(),
  mrpRupees: z.number().nonnegative().optional(),
  minWholesalePriceRupees: z.number().nonnegative().optional(),
  isTaxInclusive: z.boolean().optional(),
  taxRate: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]).optional(),
  trackInventory: z.boolean().optional(),
  openingStockQty: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  locationId: z.string().optional(),
  warehouseId: z.string().optional(),
  brand: z.string().optional(),
  rackLocation: z.string().optional(),
  description: z.string().optional(),
})

const adjustStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  locationId: z.string().optional(),
  warehouseId: z.string().optional(),
  newStockQty: z.number().nonnegative('Stock cannot be negative'),
  reason: z.enum(['PHYSICAL_COUNT', 'DAMAGE_WRITEOFF', 'FOUND_SURPLUS']),
  transactionDate: z.string().optional(),
  notes: z.string().optional(),
})

router.use(authenticate)

// GET /api/inventory/products
router.get('/products', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId
    const { search, categoryId, lowStockOnly } = req.query

    const products = await InventoryService.getProducts(orgId, {
      search: search as string,
      categoryId: categoryId as string,
      lowStockOnly: lowStockOnly === 'true',
    })

    res.json({ success: true, data: products })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/inventory/products
router.post(
  '/products',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PURCHASE', 'WAREHOUSE'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.user!.orgId
      const validated = createProductSchema.parse(req.body)

      const product = await InventoryService.createProduct(orgId, validated as any, {
        uid: req.user!.uid,
        email: req.user!.email,
      })

      res.status(201).json({ success: true, data: product })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0]?.message })
      } else {
        res.status(500).json({ success: false, error: err.message })
      }
    }
  }
)

// POST /api/inventory/adjust
router.post(
  '/adjust',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'WAREHOUSE'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.user!.orgId
      const validated = adjustStockSchema.parse(req.body)

      await InventoryService.adjustStock(orgId, validated as any, {
        uid: req.user!.uid,
        email: req.user!.email,
      })

      res.json({ success: true, message: 'Stock adjusted successfully.' })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0]?.message })
      } else {
        res.status(500).json({ success: false, error: err.message })
      }
    }
  }
)

// GET /api/inventory/products/:id/movements
router.get('/products/:id/movements', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId
    const { id } = req.params
    const movements = await InventoryService.getItemMovements(orgId, id!)
    res.json({ success: true, data: movements })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/inventory/generate-barcode
router.post('/generate-barcode', (req: AuthenticatedRequest, res: Response) => {
  const barcode = InventoryService.generateEAN13Barcode(req.body.prefix)
  res.json({ success: true, data: { barcode } })
})

export default router
