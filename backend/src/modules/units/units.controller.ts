import { Router, Response } from 'express'
import { z } from 'zod'
import { UnitsService } from './units.service'
import { authenticate, requireRole, AuthRequest } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

const createUnitRuleSchema = z.object({
  productId: z.string().optional(),
  fromUnit: z.string().min(1, 'Secondary unit symbol is required'),
  toBaseUnit: z.string().min(1, 'Base unit symbol is required'),
  conversionNumerator: z.number().positive('Numerator must be a positive integer'),
  conversionDenominator: z.number().positive().default(1),
  barcode: z.string().optional(),
  salePricePaise: z.number().nonnegative().optional(),
  purchaseCostPaise: z.number().nonnegative().optional(),
})

// GET /api/units/rules
router.get('/rules', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const { productId } = req.query
    const rules = await UnitsService.getRules(orgId, productId as string)
    res.json({ success: true, data: rules })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/units/resolve-barcode/:barcode
router.get('/resolve-barcode/:barcode', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const resolved = await UnitsService.resolveByBarcode(orgId, req.params.barcode)
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'No item or packaging found for this barcode.' })
    }
    res.json({ success: true, data: resolved })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/units/rules
router.post(
  '/rules',
  requireRole('WAREHOUSE', 'PURCHASE', 'SALES', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const validated = createUnitRuleSchema.parse(req.body)

      const rule = await UnitsService.createRule(orgId, validated as any, {
        uid: req.uid!,
        email: req.userEmail,
      })

      res.status(201).json({ success: true, data: rule })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0]?.message })
      } else {
        res.status(400).json({ success: false, error: err.message })
      }
    }
  }
)

export default router
