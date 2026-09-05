import { Router, Response } from 'express'
import { z } from 'zod'
import { SalesService } from './sales.service'
import { authenticate, requireRole, AuthRequest } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

const createSaleItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPricePaise: z.number().nonnegative('Price must be positive or zero'),
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

const createSaleInvoiceSchema = z.object({
  documentType: z.enum(['SALE_INVOICE', 'POS_SALE', 'QUOTATION']).optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
  items: z.array(createSaleItemSchema).min(1, 'At least one line item is required'),
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
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  isPosSale: z.boolean().optional(),
})

// GET /api/sales/invoices
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const { documentType, partyId, startDate, endDate, paymentStatus, search } = req.query

    const invoices = await SalesService.getInvoices(orgId, {
      documentType: documentType as string,
      partyId: partyId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      paymentStatus: paymentStatus as string,
      search: search as string,
    })

    res.json({ success: true, data: invoices })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/sales/invoices/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const invoice = await SalesService.getInvoiceById(orgId, req.params.id)

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' })
    }

    res.json({ success: true, data: invoice })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/sales/invoices
router.post(
  '/',
  requireRole('SALES', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const validated = createSaleInvoiceSchema.parse(req.body)

      const invoice = await SalesService.createInvoice(orgId, validated as any, {
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
