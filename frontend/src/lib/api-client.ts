import axios from 'axios'
import { auth } from '@/firebase/config'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

import { useAuthStore } from '@/store/auth.store'

// Attach Firebase ID token or local dev session headers to every request
apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    try {
      const token = await user.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    } catch {
      // ignore
    }
  } else {
    const storeUser = useAuthStore.getState().user
    if (storeUser) {
      config.headers.Authorization = `Bearer dev_mock_token_${storeUser.uid}`
      config.headers['x-user-uid'] = storeUser.uid
      config.headers['x-org-id'] = storeUser.orgId
      config.headers['x-user-role'] = storeUser.role
      config.headers['x-user-email'] = storeUser.email
    }
  }
  return config
})

// Standardized error handling
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Something went wrong'
    return Promise.reject(new Error(message))
  }
)

export default apiClient
