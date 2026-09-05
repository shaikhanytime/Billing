import { useState } from 'react'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth.store'
import { Loader2, ShieldCheck, Zap, Sparkles } from 'lucide-react'
import type { AppUser } from '@/types'

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const { setUser } = useAuthStore()

  // ─── Google Sign-In ──────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setError(null)
    setIsGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      const nameParts = (user.displayName || 'Enterprise User').split(' ')
      const firstName = nameParts[0] || 'User'
      const lastName = nameParts.slice(1).join(' ') || ''
      const orgId = `org_${user.uid.substring(0, 8)}`

      const userData: AppUser = {
        uid: user.uid,
        firstName,
        lastName,
        email: user.email || '',
        role: 'SUPER_ADMIN',
        orgId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Sync metadata in background
      try {
        const metaRef = doc(db, 'users_meta', user.uid)
        await setDoc(
          metaRef,
          {
            orgId,
            email: user.email,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        )

        await setDoc(
          doc(db, 'organizations', orgId),
          {
            name: user.displayName ? `${user.displayName}'s Business` : 'My Enterprise',
            email: user.email,
            status: 'ACTIVE',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )

        await setDoc(
          doc(db, 'organizations', orgId, 'users', user.uid),
          {
            ...userData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      } catch (firestoreErr) {
        console.warn('Firestore sync warning (proceeding with Google session):', firestoreErr)
      }

      // Immediately log the user in
      setUser(userData)
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string }
      if (authErr.code === 'auth/popup-closed-by-user') {
        // User closed popup
      } else if (authErr.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized in Firebase Console. Add billinganytime.vercel.app to Authorized Domains.')
      } else {
        setError(`Google sign-in error: ${authErr.message || 'Please try again.'}`)
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="w-full flex flex-col items-center text-center space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Welcome to BillingAnytime
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
          Fast, GST-compliant enterprise billing, party ledgers, and barcode inventory platform.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="w-full rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 text-left">
          {error}
        </div>
      )}

      {/* Single One-Click Google Login Button */}
      <div className="w-full space-y-3 pt-2">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-98 px-5 py-3.5 text-sm sm:text-base font-semibold text-slate-700 shadow-md hover:shadow-lg hover:border-slate-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-h-[48px]"
        >
          {isGoogleLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          ) : (
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          )}
          <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        <p className="text-[11px] text-slate-400 pt-2">
          New accounts are created automatically upon Google authorization. No password needed.
        </p>
      </div>

      {/* Feature Highlights Grid */}
      <div className="w-full pt-4 border-t border-slate-100 grid grid-cols-2 gap-2.5 text-left">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
          <Zap className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-slate-800">Fast POS Billing</p>
            <p className="text-[10px] text-slate-500">Continuous barcode scanning</p>
          </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-slate-800">GST Compliant</p>
            <p className="text-[10px] text-slate-500">Auto CGST, SGST & IGST</p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        © 2026 BillingAnytime. Enterprise Platform.
      </p>
    </div>
  )
}
