import { Request, Response, NextFunction } from 'express'
import { auth } from '../config/firebase-admin'
import { db } from '../config/firebase-admin'

export interface AuthRequest extends Request {
  uid?: string
  orgId?: string
  userRole?: string
  userEmail?: string
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Missing authorization token',
      error: { code: 'UNAUTHORIZED' },
    })
    return
  }

  const token = authHeader.split('Bearer ')[1]
  try {
    const decoded = await auth.verifyIdToken(token)
    req.uid = decoded.uid
    req.orgId = decoded['orgId'] as string | undefined
    req.userEmail = decoded.email

    // Fetch role from Firestore if orgId present
    if (req.orgId) {
      const userDoc = await db
        .collection('organizations')
        .doc(req.orgId)
        .collection('users')
        .doc(decoded.uid)
        .get()
      req.userRole = userDoc.data()?.['role'] as string | undefined
    }

    next()
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: { code: 'UNAUTHORIZED' },
    })
  }
}

type RoleLevel = 'WAREHOUSE' | 'PURCHASE' | 'SALES' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN'

const ROLE_HIERARCHY: Record<RoleLevel, number> = {
  WAREHOUSE: 1,
  PURCHASE: 2,
  SALES: 2,
  MANAGER: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
}

export function requireRole(minRole: RoleLevel) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userLevel = ROLE_HIERARCHY[req.userRole as RoleLevel] ?? 0
    const requiredLevel = ROLE_HIERARCHY[minRole]
    if (userLevel < requiredLevel) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: { code: 'FORBIDDEN' },
      })
      return
    }
    next()
  }
}
