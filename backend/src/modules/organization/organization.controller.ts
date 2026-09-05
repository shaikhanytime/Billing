import { Router, Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { db } from '../../config/firebase-admin'
import { authMiddleware, requireRole, AuthRequest } from '../../middleware/auth.middleware'
import { logAudit } from '../../services/core.service'

const router = Router()
router.use(authMiddleware)

const orgSchema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  gstNumber: z.string().optional(),
  pan: z.string().optional(),
  address: z.string().optional(),
})

const branchSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(20),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

const warehouseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(20),
  branchId: z.string(),
})

// GET /api/organization
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { orgId } = req
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }
  const docSnap = await db.collection('organizations').doc(orgId).get()
  res.json({ success: true, message: 'OK', data: { id: orgId, ...(docSnap.data() as Record<string, unknown>) } })
})

// PATCH /api/organization
router.patch('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const body = orgSchema.parse(req.body)
  const { orgId, uid } = req
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }
  await db.collection('organizations').doc(orgId).update({ ...body, updatedAt: FieldValue.serverTimestamp() })
  await logAudit({ orgId, userId: uid, action: 'ORGANIZATION_UPDATED', module: 'organization', entityType: 'Organization', entityId: orgId })
  res.json({ success: true, message: 'Organization updated', data: { id: orgId } })
})

// GET /api/organization/branches
router.get('/branches', async (req: AuthRequest, res: Response): Promise<void> => {
  const { orgId } = req
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }
  const snap = await db.collection('organizations').doc(orgId).collection('branches').where('status', '==', 'ACTIVE').get()
  res.json({ success: true, message: 'OK', data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) })
})

// POST /api/organization/branches
router.post('/branches', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const body = branchSchema.parse(req.body)
  const { orgId, uid } = req
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }
  const ref = db.collection('organizations').doc(orgId).collection('branches').doc()
  await ref.set({ ...body, orgId, status: 'ACTIVE', createdBy: uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  await logAudit({ orgId, userId: uid, action: 'BRANCH_CREATED', module: 'organization', entityType: 'Branch', entityId: ref.id })
  res.status(201).json({ success: true, message: 'Branch created', data: { id: ref.id } })
})

// PATCH /api/organization/branches/:id
router.patch('/branches/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const body = branchSchema.partial().parse(req.body)
  const { orgId, uid } = req
  const branchId = String(req.params['id'])
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }
  await db.collection('organizations').doc(orgId).collection('branches').doc(branchId).update({ ...body, updatedAt: FieldValue.serverTimestamp() })
  await logAudit({ orgId, userId: uid, action: 'BRANCH_UPDATED', module: 'organization', entityType: 'Branch', entityId: branchId })
  res.json({ success: true, message: 'Branch updated', data: { id: branchId } })
})

// GET /api/organization/warehouses
router.get('/warehouses', async (req: AuthRequest, res: Response): Promise<void> => {
  const { orgId } = req
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }
  const snap = await db.collection('organizations').doc(orgId).collection('warehouses').where('status', '==', 'ACTIVE').get()
  res.json({ success: true, message: 'OK', data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) })
})

// POST /api/organization/warehouses
router.post('/warehouses', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const body = warehouseSchema.parse(req.body)
  const { orgId, uid } = req
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }
  const ref = db.collection('organizations').doc(orgId).collection('warehouses').doc()
  await ref.set({ ...body, orgId, status: 'ACTIVE', createdBy: uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  await logAudit({ orgId, userId: uid, action: 'WAREHOUSE_CREATED', module: 'organization', entityType: 'Warehouse', entityId: ref.id })
  res.status(201).json({ success: true, message: 'Warehouse created', data: { id: ref.id } })
})

export default router
