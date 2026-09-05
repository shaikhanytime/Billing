import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth.store'
import { Eye, EyeOff, LogIn, Loader2, Sparkles } from 'lucide-react'
import type { AppUser } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const { setUser } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  // ─── Google Sign-In ──────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setError(null)
    setIsGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      // Check if user has existing org in users_meta
      const metaRef = doc(db, 'users_meta', user.uid)
      const metaDoc = await getDoc(metaRef)

      let orgId = metaDoc.exists() ? metaDoc.data()?.orgId : null

      if (!orgId) {
        // Auto-provision first organization for new Google user
        orgId = `org_${user.uid.substring(0, 8)}`
        const orgName = user.displayName ? `${user.displayName}'s Business` : 'My Enterprise'

        // Create Organization doc
        await setDoc(doc(db, 'organizations', orgId), {
          name: orgName,
          email: user.email,
          status: 'ACTIVE',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        // Create Super Admin user doc inside org
        const nameParts = (user.displayName || 'Admin User').split(' ')
        const firstName = nameParts[0] || 'Admin'
        const lastName = nameParts.slice(1).join(' ') || ''

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

        await setDoc(doc(db, 'organizations', orgId, 'users', user.uid), {
          ...userData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        // Link user to org in users_meta
        await setDoc(metaRef, {
          orgId,
          email: user.email,
          createdAt: serverTimestamp(),
        })

        setUser(userData)
      } else {
        // Load existing user profile
        const userDoc = await getDoc(doc(db, 'organizations', orgId, 'users', user.uid))
        if (userDoc.exists()) {
          setUser({ uid: user.uid, ...userDoc.data() } as AppUser)
        } else {
          // Fallback if user doc missing
          const nameParts = (user.displayName || 'User').split(' ')
          const userData: AppUser = {
            uid: user.uid,
            firstName: nameParts[0] || 'User',
            lastName: nameParts.slice(1).join(' ') || '',
            email: user.email || '',
            role: 'SUPER_ADMIN',
            orgId,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          setUser(userData)
        }
      }
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string }
      if (authErr.code === 'auth/popup-closed-by-user') {
        // User closed popup, no error needed
      } else if (authErr.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized in Firebase Console. Add your Vercel URL to Authorized Domains.')
      } else {
        setError(`Google sign-in error: ${authErr.message || 'Please try again.'}`)
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  // ─── Email / Password Sign-In ────────────────────────────────────────────────
  async function onSubmit(data: LoginForm) {
    setError(null)
    try {
      const credential = await signInWithEmailAndPassword(auth, data.email, data.password)
      const tokenResult = await credential.user.getIdTokenResult()
      const orgId = tokenResult.claims['orgId'] as string | undefined

      if (!orgId) {
        setError('Account not linked to an organization. Contact your administrator.')
        return
      }

      const userDoc = await getDoc(doc(db, 'organizations', orgId, 'users', credential.user.uid))
      if (!userDoc.exists()) {
        setError('User profile not found. Contact your administrator.')
        return
      }

      const userData = { uid: credential.user.uid, ...userDoc.data() } as AppUser
      if (userData.status !== 'ACTIVE') {
        setError('Your account has been deactivated. Contact your administrator.')
        return
      }

      setUser(userData)
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code
      if (msg === 'auth/invalid-credential' || msg === 'auth/wrong-password' || msg === 'auth/user-not-found') {
        setError('Invalid email or password.')
      } else if (msg === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.')
      } else {
        setError('Login failed. Please check your credentials or use Google Sign-In.')
      }
    }
  }

  // ─── Instant Demo Access ─────────────────────────────────────────────────────
  function handleDemoLogin() {
    setUser({
      uid: 'demo-super-admin',
      firstName: 'Salman',
      lastName: 'Shaikh',
      email: 'admin@bizops.com',
      role: 'SUPER_ADMIN',
      orgId: 'demo-org-1',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Welcome back</h2>
        <p className="mt-1.5 text-sm text-gray-400">Sign in to your BizOps account</p>
      </div>

      {/* Google Sign-In Button */}
      <div className="space-y-3 mb-6">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-700 bg-gray-800/80 hover:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:border-gray-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isGoogleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
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
          {isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}
        </button>

        {/* Instant Demo Access Button */}
        <button
          type="button"
          onClick={handleDemoLogin}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/50 px-4 py-2.5 text-sm font-semibold text-emerald-400 transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          Instant Demo Access (Explore as Admin)
        </button>

        <div className="relative my-4 flex items-center justify-center">
          <div className="border-t border-gray-800 w-full" />
          <span className="absolute bg-gray-900 px-3 text-xs text-gray-500 uppercase tracking-wider">
            Or sign in with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Email Address
          </label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="admin@business.com"
            className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 pr-10 text-sm text-gray-200 placeholder-gray-500 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
            />
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* Global error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-gray-600">
        Enterprise Billing & Inventory Operations Platform
      </p>
    </div>
  )
}
