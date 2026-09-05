import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth.store'
import type { AppUser } from '@/types'

export function useAuthInit() {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    // If user already persisted from session, allow instant render
    const persistedUser = useAuthStore.getState().user
    if (persistedUser) {
      setLoading(false)
    }

    // Safety timeout: ensure loading screen clears within 1s
    const timeoutId = setTimeout(() => {
      setLoading(false)
    }, 1000)

    try {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(timeoutId)
        if (firebaseUser) {
          const currentUser = useAuthStore.getState().user
          if (currentUser && currentUser.uid === firebaseUser.uid) {
            setLoading(false)
            return
          }

          const nameParts = (firebaseUser.displayName || 'Admin User').split(' ')
          const firstName = nameParts[0] || 'Admin'
          const lastName = nameParts.slice(1).join(' ') || ''
          const defaultOrgId = `org_${firebaseUser.uid.substring(0, 8)}`

          try {
            const tokenResult = await firebaseUser.getIdTokenResult()
            const orgId = (tokenResult.claims['orgId'] as string | undefined) || defaultOrgId

            let userData: AppUser = {
              uid: firebaseUser.uid,
              firstName,
              lastName,
              email: firebaseUser.email || '',
              role: 'SUPER_ADMIN',
              orgId,
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            try {
              const userDoc = await getDoc(
                doc(db, 'organizations', orgId, 'users', firebaseUser.uid)
              )
              if (userDoc.exists()) {
                userData = { uid: firebaseUser.uid, ...userDoc.data() } as AppUser
              }
            } catch {
              // use fallback userData
            }

            setUser(userData)
          } catch {
            setUser({
              uid: firebaseUser.uid,
              firstName,
              lastName,
              email: firebaseUser.email || '',
              role: 'SUPER_ADMIN',
              orgId: defaultOrgId,
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }
        } else {
          // If no Firebase user and not a demo user, reset
          const currentUser = useAuthStore.getState().user
          if (!currentUser || !currentUser.uid.startsWith('demo-')) {
            setUser(null)
          }
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
  }, [setUser, setLoading])
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
