import { Router, Response } from 'express'
import { z } from 'zod'
import { PartiesService } from './parties.service'
import { authenticate, requireRole } from '../../middleware/auth.middleware'
import { AuthenticatedRequest } from '../../middleware/idempotency.middleware'

const router = Router()

const createPartySchema = z.object({
  name: z.string().min(1, 'Party name is required'),
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']),
  category: z.string().optional(),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  gstin: z.string().length(15, 'GSTIN must be exactly 15 characters').optional().or(z.literal('')),
  pan: z.string().length(10).optional().or(z.literal('')),
  billingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    stateCode: z.string().length(2, 'State code must be 2 digits'),
  }),
  shippingAddress: z
    .object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
      stateCode: z.string().optional(),
    })
    .optional(),
  openingBalanceRupees: z.number().optional(),
  openingBalanceType: z.enum(['DR', 'CR']).optional(),
  creditPeriodDays: z.number().int().nonnegative().optional(),
  creditLimitRupees: z.number().nonnegative().optional(),
})

router.use(authenticate)

// GET /api/parties
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId
    const { type, search, category, balanceFilter } = req.query

    const parties = await PartiesService.getParties(orgId, {
      type: type as any,
      search: search as string,
      category: category as string,
      balanceFilter: balanceFilter as any,
    })

    res.json({ success: true, data: parties })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/parties
router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'PURCHASE'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.user!.orgId
      const validated = createPartySchema.parse(req.body)

      const party = await PartiesService.createParty(orgId, validated as any, {
        uid: req.user!.uid,
        email: req.user!.email,
      })

      res.status(201).json({ success: true, data: party })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0]?.message })
      } else {
        res.status(500).json({ success: false, error: err.message })
      }
    }
  }
)

// GET /api/parties/:id/ledger
router.get('/:id/ledger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId
    const { id } = req.params
    const { startDate, endDate } = req.query

    const ledger = await PartiesService.getPartyLedger(
      orgId,
      id!,
      startDate as string,
      endDate as string
    )

    res.json({ success: true, data: ledger })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/parties/:id/reconcile
router.post(
  '/:id/reconcile',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.user!.orgId
      const { id } = req.params
      const balance = await PartiesService.reconcilePartyBalance(orgId, id!)
      res.json({ success: true, data: { reconciledBalance: balance } })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

export default router
