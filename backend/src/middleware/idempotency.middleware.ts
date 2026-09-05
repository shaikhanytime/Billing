import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { db } from '../config/firebase-admin'
import { IdempotencyRecord } from '../types/domain.types'

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    orgId: string;
    role: string;
    email?: string;
  };
}

export async function idempotencyMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only apply to state-modifying requests
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return next()
  }

  const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined
  if (!idempotencyKey) {
    // If client didn't supply key, proceed normally
    return next()
  }

  const orgId = req.user?.orgId
  if (!orgId) {
    return next()
  }

  const payloadString = JSON.stringify(req.body || {})
  const payloadHash = crypto.createHash('sha256').update(payloadString).digest('hex')

  const keyRef = db.doc(`organizations/${orgId}/idempotencyKeys/${idempotencyKey}`)
  const snap = await keyRef.get()

  if (snap.exists) {
    const data = snap.data() as IdempotencyRecord
    if (data.requestPayloadHash !== payloadHash) {
      res.status(409).json({
        success: false,
        error: 'IDEMPOTENCY_KEY_REUSE_CONFLICT',
        message: 'This idempotency key was already used with a different request payload.',
      })
      return
    }

    if (data.status === 'COMMITTED') {
      res.status(200).json({
        success: true,
        isIdempotentReplay: true,
        transactionId: data.transactionId,
        resultRef: data.resultRef,
      })
      return
    }

    if (data.status === 'IN_PROGRESS') {
      res.status(429).json({
        success: false,
        error: 'CONCURRENT_REQUEST_IN_PROGRESS',
        message: 'A request with this idempotency key is currently processing. Please wait.',
      })
      return
    }
  }

  // Intercept response to store idempotency record on successful commit
  const originalJson = res.json.bind(res)
  res.json = function (body: any) {
    if (res.statusCode >= 200 && res.statusCode < 300 && body?.data?.id) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      keyRef.set({
        id: idempotencyKey,
        orgId,
        transactionId: body.data.transactionId || body.data.id,
        resultRef: body.data.id,
        status: 'COMMITTED',
        requestPayloadHash: payloadHash,
        createdAt: new Date().toISOString(),
        expiresAt,
      }).catch((err) => console.error('Failed to commit idempotency key:', err))
    }
    return originalJson(body)
  }

  next()
}
