import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAc_Pr5G9MNdaTg-pVu7cp2G6LF_5l9ydY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'billing-519f2.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'billing-519f2',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'billing-519f2.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '417106415787',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:417106415787:web:c436165491a1125e2ae7ee',
}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
