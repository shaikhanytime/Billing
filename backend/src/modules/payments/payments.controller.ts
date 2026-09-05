import { Router, Response } from 'express'
import { z } from 'zod'
import { PaymentsService } from './payments.service'
import { authenticate, requireRole } from '../../middleware/auth.middleware'
import { AuthenticatedRequest } from '../../middleware/idempotency.middleware'

const router = Router()

const recordPaymentSchema = z.object({
  type: z.enum(['PAYMENT_IN', 'PAYMENT_OUT']),
  partyId: z.string().min(1, 'Party ID is required'),
  partyName: z.string().min(1, 'Party name is required'),
  partyType: z.enum(['CUSTOMER', 'SUPPLIER']),
  amountRupees: z.number().positive('Payment amount must be greater than zero'),
  discountRupees: z.number().nonnegative().optional(),
  paymentMode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE']),
  bankAccountId: z.string().optional(),
  referenceNumber: z.string().optional(),
  transactionDate: z.string().optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string(),
        invoiceNumber: z.string(),
        invoiceType: z.enum(['SALE_INVOICE', 'PURCHASE_INVOICE']),
        allocatedAmountRupees: z.number().positive(),
      })
    )
    .optional(),
  notes: z.string().optional(),
})

router.use(authenticate)

// GET /api/payments
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId
    const { partyId } = req.query
    const payments = await PaymentsService.getPayments(orgId, partyId as string)
    res.json({ success: true, data: payments })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/payments
router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'PURCHASE'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.user!.orgId
      const validated = recordPaymentSchema.parse(req.body)

      const payment = await PaymentsService.recordPayment(orgId, validated as any, {
        uid: req.user!.uid,
        email: req.user!.email,
      })

      res.status(201).json({ success: true, data: payment })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0]?.message })
      } else {
        res.status(500).json({ success: false, error: err.message })
      }
    }
  }
)

export default router
