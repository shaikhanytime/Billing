import { Router, Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { db, auth as adminAuth } from '../../config/firebase-admin'
import { authMiddleware, requireRole, AuthRequest } from '../../middleware/auth.middleware'
import { logAudit } from '../../services/core.service'

const router = Router()
router.use(authMiddleware)

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'SALES', 'PURCHASE', 'WAREHOUSE']),
  branchId: z.string().optional(),
})

const updateUserSchema = createUserSchema.omit({ email: true, password: true }).partial()

// GET /api/users
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { orgId } = req
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }
  const snap = await db.collection('organizations').doc(orgId).collection('users').get()
  res.json({ success: true, message: 'OK', data: snap.docs.map((d) => ({ uid: d.id, ...d.data() as Record<string, unknown> })) })
})

// POST /api/users
router.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const body = createUserSchema.parse(req.body)
  const { orgId, uid: creatorId } = req
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }

  const fbUser = await adminAuth.createUser({ email: body.email, password: body.password })
  await adminAuth.setCustomUserClaims(fbUser.uid, { orgId })

  const userData = {
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    role: body.role,
    orgId,
    branchId: body.branchId ?? null,
    status: 'ACTIVE',
    createdBy: creatorId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
  await db.collection('organizations').doc(orgId).collection('users').doc(fbUser.uid).set(userData)
  await db.collection('users_meta').doc(fbUser.uid).set({ orgId, createdAt: FieldValue.serverTimestamp() })

  await logAudit({ orgId, userId: creatorId, action: 'USER_CREATED', module: 'users', entityType: 'User', entityId: fbUser.uid, newValues: { email: body.email, role: body.role } })
  res.status(201).json({ success: true, message: 'User created', data: { uid: fbUser.uid, ...userData } })
})

// PATCH /api/users/:id
router.patch('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const body = updateUserSchema.parse(req.body)
  const { orgId, uid: editorId } = req
  const targetId = String(req.params['id'])
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }

  const userRef = db.collection('organizations').doc(orgId).collection('users').doc(targetId)
  const existing = await userRef.get()
  if (!existing.exists) { res.status(404).json({ success: false, message: 'User not found', error: { code: 'NOT_FOUND' } }); return }

  await userRef.update({ ...body, updatedAt: FieldValue.serverTimestamp() })
  await logAudit({ orgId, userId: editorId, action: 'USER_UPDATED', module: 'users', entityType: 'User', entityId: targetId, oldValues: existing.data(), newValues: body })
  res.json({ success: true, message: 'User updated', data: { uid: targetId } })
})

// PATCH /api/users/:id/status
router.patch('/:id/status', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) }).parse(req.body)
  const { orgId, uid: editorId } = req
  const targetId = String(req.params['id'])
  if (!orgId) { res.status(400).json({ success: false, message: 'No org', error: { code: 'BAD_REQUEST' } }); return }

  await db.collection('organizations').doc(orgId).collection('users').doc(targetId).update({ status, updatedAt: FieldValue.serverTimestamp() })
  await adminAuth.updateUser(targetId, { disabled: status !== 'ACTIVE' })
  await logAudit({ orgId, userId: editorId, action: 'USER_STATUS_CHANGED', module: 'users', entityType: 'User', entityId: targetId, newValues: { status } })
  res.json({ success: true, message: 'Status updated', data: { uid: targetId, status } })
})

export default router
