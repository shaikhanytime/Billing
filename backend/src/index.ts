import { onRequest } from 'firebase-functions/v2/https'
import app from './app'

// Export the Express app as a single Firebase Cloud Function
export const api = onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    cors: true,
  },
  app
)
