import { Router, Response } from 'express'
import { z } from 'zod'
import { QuotationsService } from './quotations.service'
import { QuotationStatus } from '../../types/domain.types'
import { authenticate, requireRole, AuthRequest } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

const createQuotationItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  enteredQuantity: z.number().positive('Quantity must be greater than 0'),
  enteredUnit: z.string().optional(),
  conversionNumerator: z.number().positive().optional(),
  conversionDenominator: z.number().positive().optional(),
  unitPricePaise: z.number().nonnegative().optional(),
  isTaxInclusive: z.boolean().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountPaise: z.number().nonnegative().optional(),
  taxRate: z.union([
    z.literal(0),
    z.literal(5),
    z.literal(12),
    z.literal(18),
    z.literal(28),
  ]),
})

const createQuotationSchema = z.object({
  quotationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  partyId: z.string().optional(),
  partyName: z.string().min(1, 'Party/Customer name is required'),
  partyPhone: z.string().optional(),
  partyGstin: z.string().optional(),
  partyStateCode: z.string().optional(),
  billingAddress: z
    .object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
      stateCode: z.string(),
    })
    .optional(),
  shippingAddress: z
    .object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
      stateCode: z.string().optional(),
    })
    .optional(),
  placeOfSupply: z.string().length(2, 'Place of supply must be a 2-digit state code'),
  warehouseId: z.string().default('MAIN'),
  locationId: z.string().optional(),
  items: z.array(createQuotationItemSchema).min(1, 'At least one line item is required'),
  discountPaise: z.number().nonnegative().optional(),
  additionalChargesPaise: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'EXPIRED', 'DECLINED']).optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'EXPIRED', 'DECLINED']),
})

// GET /api/sales/quotations
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const { status, partyId, startDate, endDate, search, limit } = req.query

    const quotations = await QuotationsService.getQuotations(orgId, {
      status: status as QuotationStatus,
      partyId: partyId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
      limit: limit ? Number(limit) : undefined,
    })

    res.json({ success: true, data: quotations })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/sales/quotations/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const quotation = await QuotationsService.getQuotationById(orgId, req.params.id)

    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found.' })
    }

    res.json({ success: true, data: quotation })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/sales/quotations
router.post(
  '/',
  requireRole('SALES', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const validated = createQuotationSchema.parse(req.body)

      const quotation = await QuotationsService.createQuotation(orgId, validated as any, {
        uid: req.uid!,
        email: req.userEmail,
      })

      res.status(201).json({ success: true, data: quotation })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0]?.message })
      } else {
        res.status(400).json({ success: false, error: err.message })
      }
    }
  }
)

// PATCH /api/sales/quotations/:id/status
router.patch(
  '/:id/status',
  requireRole('SALES', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const { status } = updateStatusSchema.parse(req.body)

      const updated = await QuotationsService.updateQuotationStatus(
        orgId,
        req.params.id,
        status,
        {
          uid: req.uid!,
          email: req.userEmail,
        }
      )

      res.json({ success: true, data: updated })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0]?.message })
      } else {
        res.status(400).json({ success: false, error: err.message })
      }
    }
  }
)

// POST /api/sales/quotations/:id/convert
router.post(
  '/:id/convert',
  requireRole('SALES', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const result = await QuotationsService.convertQuotationToInvoice(
        orgId,
        req.params.id,
        {
          uid: req.uid!,
          email: req.userEmail,
        }
      )

      res.status(200).json({
        success: true,
        message: `Quotation converted successfully to Invoice #${result.invoice.documentNumber}`,
        data: result,
      })
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message })
    }
  }
)

export default router
