import { Navigate } from 'react-router-dom'
import authService from '../services/api'
import NoPermission from './NoPermission'

const PermissionGuard = ({ children, permission, pageName, redirectToDashboard = false }) => {
  const user = authService.getCurrentUser()
  
  // Check if user is authenticated
  if (!authService.isAuthenticated() || !user) {
    return <Navigate to="/login" replace />
  }

  // Check if user is approved
  if (!user.is_approved) {
    return <Navigate to="/login" replace />
  }

  // Super Admins have all permissions
  if (user.role === 'Super Admin') {
    return children
  }

  // Check if user has the required permission
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





