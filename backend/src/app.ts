import express from 'express'
import cors from 'cors'
import authRouter from './modules/auth/auth.controller'
import usersRouter from './modules/users/users.controller'
import orgRouter from './modules/organization/organization.controller'
import { errorHandler, notFound } from './middleware/error.middleware'

const app = express()

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env['CORS_ORIGIN'] ?? '*',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'BillingAnytime API is running', data: { version: '1.0.0', phase: 1 } })
})

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/organization', orgRouter)

// 404 + Error handler (must be last)
app.use(notFound)
app.use(errorHandler)

export default app
