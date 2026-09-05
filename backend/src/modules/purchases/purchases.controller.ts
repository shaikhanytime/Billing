import { Router, Response } from 'express'
import { z } from 'zod'
import { PurchasesService } from './purchases.service'
import { authenticate, requireRole, AuthRequest } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

const createPurchaseItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitCostPaise: z.number().nonnegative('Cost must be positive or zero'),
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

const createPurchaseInvoiceSchema = z.object({
  documentType: z.enum(['PURCHASE_INVOICE', 'PURCHASE_RETURN']).optional(),
  vendorBillNumber: z.string().min(1, 'Vendor bill number is required'),
  vendorBillDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid vendor bill date (YYYY-MM-DD)'),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid invoice date (YYYY-MM-DD)'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  partyId: z.string().min(1, 'Supplier is required'),
  partyName: z.string().min(1, 'Supplier name is required'),
  partyGstin: z.string().optional(),
  partyStateCode: z.string().optional(),
  placeOfSupply: z.string().length(2, 'Place of supply must be a 2-digit state code'),
  warehouseId: z.string().default('MAIN'),
  locationId: z.string().optional(),
  items: z.array(createPurchaseItemSchema).min(1, 'At least one line item is required'),
  discountPaise: z.number().nonnegative().optional(),
  additionalChargesPaise: z.number().nonnegative().optional(),
  payment: z
    .object({
      paymentMode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE']),
      amountPaise: z.number().positive(),
      bankAccountId: z.string().optional(),
      referenceNumber: z.string().optional(),
    })
    .optional(),
  rcmApplicable: z.boolean().optional(),
  notes: z.string().optional(),
})

// GET /api/purchases/invoices
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const { partyId, startDate, endDate, paymentStatus } = req.query

    const invoices = await PurchasesService.getInvoices(orgId, {
      partyId: partyId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      paymentStatus: paymentStatus as string,
    })

    res.json({ success: true, data: invoices })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/purchases/invoices/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const invoice = await PurchasesService.getInvoiceById(orgId, req.params.id)

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Purchase invoice not found.' })
    }

    res.json({ success: true, data: invoice })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/purchases/invoices
router.post(
  '/',
  requireRole('PURCHASE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const validated = createPurchaseInvoiceSchema.parse(req.body)

      const invoice = await PurchasesService.createInvoice(orgId, validated as any, {
        uid: req.uid!,
        email: req.userEmail,
      })

      res.status(201).json({ success: true, data: invoice })
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
