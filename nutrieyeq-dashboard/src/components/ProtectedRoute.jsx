import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import authService from '../services/api'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000

const ProtectedRoute = ({ children }) => {
  const isAuth = authService.isAuthenticated()
  const user = authService.getCurrentUser()
  const timerRef = useRef(null)

  useEffect(() => {
    if (!isAuth) return

    const reset = () => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        authService.logout()
      }, IDLE_TIMEOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      clearTimeout(timerRef.current)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [isAuth])

  if (!isAuth || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.is_approved) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute

