import { Navigate } from 'react-router-dom'
import authService from '../services/api'

const ProtectedRoute = ({ children }) => {
  const isAuth = authService.isAuthenticated()
  const user = authService.getCurrentUser()
  
  // Not authenticated - redirect to login
  if (!isAuth) {
    return <Navigate to="/login" replace />
  }

  // Not approved - redirect to login
  if (user && !user.is_approved) {
    return <Navigate to="/login" replace />
  }
  
  // Authentication passed - let the page handle its own permission checking
  return children
}

export default ProtectedRoute

