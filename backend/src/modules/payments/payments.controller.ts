import { Router, Response } from 'express'
import { z } from 'zod'
import { PaymentsService } from './payments.service'
import { authenticate, requireRole, AuthRequest } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

const recordPaymentSchema = z.object({
  type: z.enum(['PAYMENT_IN', 'PAYMENT_OUT']),
  partyId: z.string().min(1, 'Party ID is required'),
  partyName: z.string().min(1, 'Party name is required'),
  partyType: z.enum(['CUSTOMER', 'SUPPLIER']),
  paymentAmountPaise: z.number().nonnegative().optional(),
  paymentAmountRupees: z.number().nonnegative().optional(),
  discountPaise: z.number().nonnegative().optional(),
  discountRupees: z.number().nonnegative().optional(),
  paymentMode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE']),
  bankAccountId: z.string().optional(),
  referenceNumber: z.string().optional(),
  transactionDate: z.string().optional(),
  autoAllocateFIFO: z.boolean().optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string(),
        invoiceNumber: z.string().optional(),
        invoiceType: z.enum(['SALE_INVOICE', 'PURCHASE_INVOICE']).optional(),
        paymentAllocatedPaise: z.number().nonnegative().optional(),
        discountAllocatedPaise: z.number().nonnegative().optional(),
        allocatedAmountRupees: z.number().nonnegative().optional(),
      })
    )
    .optional(),
  notes: z.string().optional(),
  locationId: z.string().optional(),
  warehouseId: z.string().optional(),
})

const reversePaymentSchema = z.object({
  reason: z.string().optional(),
})

const applyAdvanceSchema = z.object({
  sourcePaymentId: z.string().min(1, 'Source payment voucher ID is required'),
  invoiceId: z.string().min(1, 'Target invoice ID is required'),
  invoiceType: z.enum(['SALE_INVOICE', 'PURCHASE_INVOICE']),
  amountPaise: z.number().positive().optional(),
  amountRupees: z.number().positive().optional(),
})

// GET /api/payments
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const { type, partyId, paymentMode, status, startDate, endDate, limit } = req.query
    const payments = await PaymentsService.getPayments(orgId, {
      type: type as any,
      partyId: partyId as string,
      paymentMode: paymentMode as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? Number(limit) : undefined,
    })
    res.json({ success: true, data: payments })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/payments/eligible-invoices/:partyId
router.get('/eligible-invoices/:partyId', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const partyType = (req.query.partyType as 'CUSTOMER' | 'SUPPLIER') || 'CUSTOMER'
    const invoices = await PaymentsService.getEligibleInvoices(orgId, req.params.partyId, partyType)
    res.json({ success: true, data: invoices })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/payments/available-advances/:partyId
router.get('/available-advances/:partyId', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const advances = await PaymentsService.getAvailableAdvances(orgId, req.params.partyId)
    res.json({ success: true, data: advances })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/payments/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.orgId!
    const payment = await PaymentsService.getPaymentById(orgId, req.params.id)
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment voucher not found.' })
    }
    res.json({ success: true, data: payment })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/payments
router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'PURCHASE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const validated = recordPaymentSchema.parse(req.body)

      const payment = await PaymentsService.recordPayment(orgId, validated as any, {
        uid: req.uid!,
        email: req.userEmail,
      })

      res.status(201).json({ success: true, data: payment })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0]?.message })
      } else {
        res.status(400).json({ success: false, error: err.message })
      }
    }
  }
)

// POST /api/payments/:id/reverse
router.post(
  '/:id/reverse',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const { reason } = reversePaymentSchema.parse(req.body || {})

      const reversed = await PaymentsService.reversePayment(orgId, req.params.id, reason || '', {
        uid: req.uid!,
        email: req.userEmail,
      })

      res.json({ success: true, message: 'Payment voucher reversed successfully.', data: reversed })
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message })
    }
  }
)

// POST /api/payments/apply-advance
router.post(
  '/apply-advance',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'PURCHASE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const validated = applyAdvanceSchema.parse(req.body)

      const alloc = await PaymentsService.applyAdvance(orgId, validated as any, {
        uid: req.uid!,
        email: req.userEmail,
      })

      res.status(201).json({ success: true, message: 'Advance applied successfully.', data: alloc })
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message })
    }
  }
)

// POST /api/payments/advance-allocations/:id/reverse
router.post(
  '/advance-allocations/:id/reverse',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.orgId!
      const { reason } = reversePaymentSchema.parse(req.body || {})

      const reversed = await PaymentsService.reverseAdvanceAllocation(
        orgId,
        req.params.id,
        reason || '',
        {
          uid: req.uid!,
          email: req.userEmail,
        }
      )

      res.json({ success: true, message: 'Advance allocation reversed successfully.', data: reversed })
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message })
    }
  }
)

export default router
