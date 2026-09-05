import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: err.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    })
    return
  }

  const status = (err as { status?: number })?.status ?? 500
  const message = (err as Error)?.message ?? 'Internal server error'
  const code = (err as { code?: string })?.code ?? 'INTERNAL_ERROR'

  // Never expose stack traces in production
  if (process.env['NODE_ENV'] !== 'production') {
    console.error('[ERROR]', err)
  }

  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : message,
    error: { code },
  })
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: { code: 'NOT_FOUND' },
  })
}
