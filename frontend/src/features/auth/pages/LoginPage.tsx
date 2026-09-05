import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth.store'
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react'
import type { AppUser } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setUser } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

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
        setError('Login failed. Please try again.')
      }
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Welcome back</h2>
        <p className="mt-1.5 text-sm text-gray-400">Sign in to your BizOps account</p>
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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
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
        Access requires an administrator account.
        <br />
        Contact your system administrator for credentials.
      </p>
    </div>
  )
}
