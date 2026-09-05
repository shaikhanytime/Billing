import { Router, Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { db, auth as adminAuth } from '../../config/firebase-admin'
import { authMiddleware, requireRole, AuthRequest } from '../../middleware/auth.middleware'
import { logAudit } from '../../services/core.service'

const router = Router()

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { uid, orgId } = req
  if (!uid || !orgId) {
    res.status(404).json({ success: false, message: 'User not found', error: { code: 'NOT_FOUND' } })
    return
  }
  const userDoc = await db.collection('organizations').doc(orgId).collection('users').doc(uid).get()
  if (!userDoc.exists) {
    res.status(404).json({ success: false, message: 'User profile not found', error: { code: 'NOT_FOUND' } })
    return
  }
  res.json({ success: true, message: 'OK', data: { uid, ...userDoc.data() } })
})

const setupOrgSchema = z.object({
  orgName: z.string().min(2),
  legalName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
})

// POST /api/auth/setup-org — first-time setup
router.post('/setup-org', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const body = setupOrgSchema.parse(req.body)
  const { uid } = req

  if (!uid) { res.status(401).json({ success: false, message: 'Unauthorized', error: { code: 'UNAUTHORIZED' } }); return }

  // Check if user already has an org
  const tokenResult = await db.collection('users_meta').doc(uid).get()
  if (tokenResult.exists) {
    res.status(409).json({ success: false, message: 'Organization already set up', error: { code: 'CONFLICT' } })
    return
  }

  const batch = db.batch()
  const orgRef = db.collection('organizations').doc()
  const orgId = orgRef.id

  // Create org
  batch.set(orgRef, {
    name: body.orgName,
    legalName: body.legalName ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    status: 'ACTIVE',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Create super admin user doc
  const userRef = orgRef.collection('users').doc(uid)
  batch.set(userRef, {
    firstName: body.adminFirstName,
    lastName: body.adminLastName,
    email: req.userEmail ?? '',
    role: 'SUPER_ADMIN',
    orgId,
    status: 'ACTIVE',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Track that this uid has an org
  batch.set(db.collection('users_meta').doc(uid), { orgId, createdAt: FieldValue.serverTimestamp() })

  await batch.commit()

  // Set custom claim so orgId is in JWT
  await adminAuth.setCustomUserClaims(uid, { orgId })

  await logAudit({ orgId, userId: uid, action: 'ORGANIZATION_CREATED', module: 'organization', entityType: 'Organization', entityId: orgId })

  res.status(201).json({ success: true, message: 'Organization created successfully', data: { orgId } })
})

export default router
