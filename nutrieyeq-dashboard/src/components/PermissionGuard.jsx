import { Navigate } from 'react-router-dom'
import authService from '../services/api'
import NoPermission from './NoPermission'

const PermissionGuard = ({ children, permission, pageName, redirectToDashboard = false }) => {
  const user = authService.getCurrentUser()
  

  if (!authService.isAuthenticated() || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.is_approved) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'Super Admin') {
    return children
  }

  const hasPermission = user.permissions?.includes(permission)

  if (!hasPermission) {
    if (redirectToDashboard) {
      return <Navigate to="/dashboard" replace />
    }
    return <NoPermission pageName={pageName} />
  }

  return children
}

export default PermissionGuard

