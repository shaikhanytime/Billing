import { useAuthInit } from './hooks/useAuth'
import { AppRouter } from './routes'

export function App() {
  // Initialize Firebase Auth listener → syncs to Zustand store
  useAuthInit()
  return <AppRouter />
}
