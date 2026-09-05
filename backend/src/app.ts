import express from 'express'
import cors from 'cors'
import authRouter from './modules/auth/auth.controller'
import usersRouter from './modules/users/users.controller'
import orgRouter from './modules/organization/organization.controller'
import partiesRouter from './modules/parties/parties.controller'
import inventoryRouter from './modules/inventory/inventory.controller'
import paymentsRouter from './modules/payments/payments.controller'
import salesRouter from './modules/sales/sales.controller'
import purchasesRouter from './modules/purchases/purchases.controller'
import { idempotencyMiddleware } from './middleware/idempotency.middleware'
import { errorHandler, notFound } from './middleware/error.middleware'

const app = express()

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env['CORS_ORIGIN'] ?? '*',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(idempotencyMiddleware)

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'BillingAnytime API is running', data: { version: '2.1.2', phase: 2 } })
})

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/organization', orgRouter)
app.use('/api/parties', partiesRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/sales', salesRouter)
app.use('/api/purchases', purchasesRouter)

// 404 + Error handler (must be last)
app.use(notFound)
app.use(errorHandler)

export default app
