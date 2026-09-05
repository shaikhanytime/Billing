import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth.store'
import type { AppUser } from '@/types'

export function useAuthInit() {
  const { setUser, setLoading, user } = useAuthStore()

  useEffect(() => {
    // If user already persisted from demo session, stop loading
    if (user) {
      setLoading(false)
    }

    // Safety timeout: ensure loading screen clears within 1.5s
    const timeoutId = setTimeout(() => {
      setLoading(false)
    }, 1500)

    try {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(timeoutId)
        if (firebaseUser) {
          try {
            const tokenResult = await firebaseUser.getIdTokenResult()
            const orgId = tokenResult.claims['orgId'] as string | undefined

            if (orgId) {
              const userDoc = await getDoc(
                doc(db, 'organizations', orgId, 'users', firebaseUser.uid)
              )
              if (userDoc.exists()) {
                setUser({ uid: firebaseUser.uid, ...userDoc.data() } as AppUser)
              } else {
                setUser(null)
              }
            } else {
              setUser(null)
            }
          } catch {
            setUser(null)
          }
        } else if (!user) {
          setUser(null)
        }
        setLoading(false)
      })

      return () => {
        clearTimeout(timeoutId)
        unsubscribe()
      }
    } catch {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [setUser, setLoading, user])
}

export function useAuth() {
  const { user, orgId, isLoading } = useAuthStore()
  return { user, orgId, isLoading, isAuthenticated: !!user }
}

export function useRole() {
  const { user } = useAuthStore()
  const role = user?.role

  return {
    role,
    isSuperAdmin: role === 'SUPER_ADMIN',
    isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
    isManager: role === 'MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN',
    isSales: role === 'SALES' || role === 'MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN',
    isPurchase: role === 'PURCHASE' || role === 'MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN',
    isWarehouse: role === 'WAREHOUSE' || role === 'MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN',
  }
}
