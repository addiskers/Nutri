import { useState, useEffect } from 'react'
import { X, Shield, CheckCircle, AlertCircle } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const PermissionsPanel = ({ isOpen, onClose, user, currentUserRole, onUpdate }) => {
  const [permissions, setPermissions] = useState({
    products: false,
    addProduct: false,
    editProduct: false,
    deleteProduct: false,
    compare: false,
    users: false,
    nomenclature: false,
    exportData: false
  })
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Map backend permissions to frontend keys
  const backendToFrontendMap = {
    'view_products': 'products',
    'add_products': 'addProduct',
    'edit_products': 'editProduct',
    'delete_products': 'deleteProduct',
    'run_comparisons': 'compare',
    'view_users': 'users',
    'add_users': 'users',
    'edit_users': 'users',
    'delete_users': 'users',
    'manage_permissions': 'users',
    'view_nomenclature': 'nomenclature',
    'edit_nomenclature': 'nomenclature',
    'export_data': 'exportData'
  }

  // Map frontend keys to backend permissions
  const frontendToBackendMap = {
    'products': 'view_products',
    'addProduct': 'add_products',
    'editProduct': 'edit_products',
    'deleteProduct': 'delete_products',
    'compare': 'run_comparisons',
    'users': 'view_users',
    'nomenclature': 'view_nomenclature',
    'exportData': 'export_data'
  }

  // Load permissions and role from user data
  useEffect(() => {
    if (user && user.permissions) {
      const frontendPerms = {
        products: false,
        addProduct: false,
        editProduct: false,
        deleteProduct: false,
        compare: false,
        users: false,
        nomenclature: false,
        exportData: false
      }

      // Convert backend permissions to frontend format
      user.permissions.forEach(perm => {
        const frontendKey = backendToFrontendMap[perm]
        if (frontendKey) {
          frontendPerms[frontendKey] = true
        }
      })

      setPermissions(frontendPerms)
      setSelectedRole(user.role)
    }
  }, [user])

  const handleTogglePermission = (permission) => {
    // Only Super Admin can modify permissions
    if (currentUserRole !== 'Super Admin') {
      setError('Only Super Admins can modify permissions')
      return
    }

    setPermissions({
      ...permissions,
      [permission]: !permissions[permission]
    })
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    
    try {
      const token = localStorage.getItem('access_token')
      
      // Convert frontend permissions to backend format
      const backendPermissions = []
      Object.keys(permissions).forEach(key => {
        if (permissions[key]) {
          // Add base permission
          const backendPerm = frontendToBackendMap[key]
          if (backendPerm && !backendPermissions.includes(backendPerm)) {
            backendPermissions.push(backendPerm)
          }
          
          // Add related permissions based on role
          if (key === 'users' && permissions.users) {
            if (!backendPermissions.includes('view_users')) backendPermissions.push('view_users')
            if (!backendPermissions.includes('add_users')) backendPermissions.push('add_users')
            if (!backendPermissions.includes('edit_users')) backendPermissions.push('edit_users')
            if (selectedRole === 'Super Admin') {
              if (!backendPermissions.includes('delete_users')) backendPermissions.push('delete_users')
              if (!backendPermissions.includes('manage_permissions')) backendPermissions.push('manage_permissions')
            }
          }
          
          if (key === 'editProduct' && permissions.editProduct) {
            if (!backendPermissions.includes('view_products')) backendPermissions.push('view_products')
          }
          
          if (key === 'deleteProduct' && permissions.deleteProduct) {
            if (!backendPermissions.includes('view_products')) backendPermissions.push('view_products')
            if (!backendPermissions.includes('edit_products')) backendPermissions.push('edit_products')
          }
          
          if (key === 'nomenclature' && permissions.nomenclature) {
            if (!backendPermissions.includes('view_nomenclature')) backendPermissions.push('view_nomenclature')
            if (!backendPermissions.includes('edit_nomenclature')) backendPermissions.push('edit_nomenclature')
          }
        }
      })

      const updateData = {
        permissions: backendPermissions
      }

      // Include role if it has changed
      if (selectedRole !== user.role) {
        updateData.role = selectedRole
      }

      const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        setSuccessMessage(selectedRole !== user.role ? 'Role and permissions updated successfully!' : 'Permissions updated successfully!')
        if (onUpdate) await onUpdate()
        setTimeout(() => {
          setSuccessMessage('')
        }, 2000)
      } else {
        const errorData = await response.json()
        setError(errorData.detail || 'Failed to update permissions')
      }
    } catch (err) {
      setError('Failed to update permissions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !user) return null

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-[rgba(36,99,235,0.1)] text-[#009da5]'
      case 'Admin':
        return 'bg-[#f1f5f9] text-[#65758b]'
      case 'Researcher':
        return 'bg-[#fef7e1] text-[#e7b008]'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const permissionItems = [
    {
      key: 'products',
      title: 'Access Products Page',
      description: 'Allows viewing product and ingredient data.'
    },
    {
      key: 'addProduct',
      title: 'Access Add Product Page',
      description: 'Allows adding new products and drafting nutrition inputs.'
    },
    {
      key: 'editProduct',
      title: 'Edit Products',
      description: 'Allows modifying existing products.'
    },
    {
      key: 'deleteProduct',
      title: 'Delete Products',
      description: 'Allows removing products from system.'
    },
    {
      key: 'compare',
      title: 'Access Compare Page',
      description: 'Allows running comparisons between products and COAs.'
    },
    {
      key: 'users',
      title: 'Manage Users',
      description: 'Allows user management and permissions.'
    },
    {
      key: 'nomenclature',
      title: 'Manage Nomenclature',
      description: 'Allows editing nomenclature mappings.'
    },
    {
      key: 'exportData',
      title: 'Export Data',
      description: 'Allows exporting reports and data.'
    }
  ]

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-[#f9fafb] border-l border-[#e1e7ef] shadow-xl z-50 overflow-y-auto">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-[#b455a0] rounded-full animate-spin"></div>
              </div>
              <p className="text-sm font-ibm-plex font-medium text-[#b455a0]">
                Updating permissions...
              </p>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="bg-white border-b border-[#e1e7ef] p-6 sticky top-0 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-ibm-plex font-semibold text-[#0f1729] mb-1">
                Permissions
              </h2>
              <p className="text-sm font-ibm-plex text-[#65758b]">
                Review and manage feature access by role
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors opacity-70"
            >
              <X className="w-4 h-4 text-[#0f1729]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-ibm-plex">{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-ibm-plex">{error}</span>
              <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">×</button>
            </div>
          )}

          {/* User Info Card */}
          <div className="bg-white border border-[#e1e7ef] rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center">
                  <span className="text-xs font-ibm-plex font-semibold text-[#0f1729]">
                    {user.initials}
                  </span>
                </div>
                <div>
                  <div className="text-base font-ibm-plex font-semibold text-[#0f1729]">
                    {user.name}
                  </div>
                  <div className="text-sm font-ibm-plex text-[#65758b]">
                    {user.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-ibm-plex font-semibold ${getRoleBadgeStyle(user.role)}`}>
                  {user.role}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-ibm-plex font-semibold ${
                  user.status === 'Active' ? 'bg-[#e4fbed] text-[#16a249]' : 'bg-[rgba(239,67,67,0.1)] text-[#ef4343]'
                }`}>
                  {user.status}
                </span>
              </div>
            </div>
          </div>

          {/* Role Assignment Section */}
          {(currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && user.role !== 'Super Admin' && (
            <div className="bg-white border border-[#e1e7ef] rounded-lg p-4">
              <h3 className="text-sm font-ibm-plex font-semibold text-[#0f1729] mb-3">
                Assign Role
              </h3>
              <div className="space-y-2">
                <label className="text-xs font-ibm-plex text-[#65758b]">User Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-ibm-plex text-[#0f1729] bg-[#f9fafb] border border-[#e1e7ef] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009da5]"
                  disabled={currentUserRole === 'Admin' && user.role === 'Admin'}
                >
                  <option value="Researcher">Researcher</option>
                  <option value="Admin" disabled={currentUserRole === 'Admin'}>Admin</option>
                  {currentUserRole === 'Super Admin' && (
                    <option value="Super Admin">Super Admin</option>
                  )}
                </select>
                <p className="text-xs font-ibm-plex text-[#65758b]">
                  {currentUserRole === 'Admin' 
                    ? 'Admins can assign Researcher role. Only Super Admins can assign Admin or Super Admin roles.'
                    : 'Super Admins can assign any role to users.'}
                </p>
              </div>
            </div>
          )}

          {/* Permissions Section - All Roles */}
          <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[#0f1729]" />
              <h3 className="text-sm font-ibm-plex font-semibold text-[#0f1729]">
                {user.role} Permissions
              </h3>
            </div>

            {permissionItems.map((item, index) => (
              <div key={item.key}>
                <div className="flex items-start justify-between py-3">
                  <div className="flex-1">
                    <div className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-0.5">
                      {item.title}
                    </div>
                    <div className="text-xs font-ibm-plex text-[#65758b]">
                      {item.description}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTogglePermission(item.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ml-4 ${
                      permissions[item.key] ? 'bg-[#009da5]' : 'bg-[#e1e7ef]'
                    }`}
                    disabled={currentUserRole !== 'Super Admin'}
                    title={currentUserRole !== 'Super Admin' ? 'Only Super Admins can modify permissions' : ''}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                        permissions[item.key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                {index !== permissionItems.length - 1 && (
                  <div className="h-px bg-[#e1e7ef]" />
                )}
              </div>
            ))}

            {currentUserRole !== 'Super Admin' && (
              <p className="text-xs font-ibm-plex text-[#65758b] pt-2">
                Only Super Admins can modify permissions.
              </p>
            )}
            {currentUserRole === 'Super Admin' && user.role !== 'Super Admin' && (
              <p className="text-xs font-ibm-plex text-[#65758b] pt-2">
                {user.role} permissions are configured at the role level and applied to all {user.role} users.
              </p>
            )}
            {user.role === 'Super Admin' && (
              <p className="text-xs font-ibm-plex text-[#65758b] pt-2">
                Super Admins have full access to all features and can manage all users, roles, and permissions.
              </p>
            )}
          </div>

          {/* Save Button (for Admin and Super Admin) */}
          {(currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && user.role !== 'Super Admin' && (
            <div className="flex gap-3 sticky bottom-0 bg-[#f9fafb] pt-4 pb-2">
              <button
                onClick={onClose}
                className="flex-1 h-10 px-4 py-2 border border-[#e1e7ef] bg-white rounded-md text-sm font-ibm-plex font-medium text-[#0f1729] hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 h-10 px-4 py-2 bg-[#009da5] rounded-md text-sm font-ibm-plex font-medium text-white hover:bg-[#008891] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Close button for non-editable view */}
          {(currentUserRole === 'Researcher' || user.role === 'Super Admin') && (
            <div className="sticky bottom-0 bg-[#f9fafb] pt-4 pb-2">
              <button
                onClick={onClose}
                className="w-full h-10 px-4 py-2 bg-[#009da5] rounded-md text-sm font-ibm-plex font-medium text-white hover:bg-[#008891] transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default PermissionsPanel

