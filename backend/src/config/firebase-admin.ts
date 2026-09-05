import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'

let app: App
if (!getApps().length) {
  app = initializeApp()
} else {
  app = getApps()[0]!
}

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
export { app }
