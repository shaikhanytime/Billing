import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppUser } from '@/types'

interface AuthState {
  user: AppUser | null
  orgId: string | null
  isLoading: boolean
  setUser: (user: AppUser | null) => void
  setOrgId: (orgId: string | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      orgId: null,
      isLoading: true,
      setUser: (user) => set({ user, orgId: user?.orgId ?? null, isLoading: false }),
      setOrgId: (orgId) => set({ orgId }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, orgId: null, isLoading: false }),
    }),
    {
      name: 'bizops-auth',
      partialize: (state) => ({ user: state.user, orgId: state.orgId }),
    }
  )
)
