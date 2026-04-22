import { Navigate } from 'react-router-dom'
import authService from '../services/api'

const ProtectedRoute = ({ children }) => {
  const isAuth = authService.isAuthenticated()
  const user = authService.getCurrentUser()
  
  if (!isAuth || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.is_approved) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

export default ProtectedRoute

