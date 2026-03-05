import { useState, useEffect } from 'react'
import { X, Shield, CheckCircle, AlertCircle, CheckSquare, Square } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// All 19 available permissions (14 original + 5 new COA permissions)
const ALL_PERMISSIONS = [
  'view_products',
  'add_products',
  'edit_products',
  'delete_products',
  'view_coa',
  'add_coa',
  'edit_coa',
  'delete_coa',
  'use_coa_in_formulation',
  'view_users',
  'add_users',
  'edit_users',
  'delete_users',
  'manage_permissions',
  'view_nomenclature',
  'edit_nomenclature',
  'run_comparisons',
  'view_analytics',
  'export_data'
]

const PermissionsPanel = ({ isOpen, onClose, user, currentUserRole, onUpdate }) => {
  const [selectedPermissions, setSelectedPermissions] = useState([])
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Load permissions from user data
  useEffect(() => {
    if (user && user.permissions) {
      setSelectedPermissions(user.permissions)
      setSelectedRole(user.role)
    }
  }, [user])

  const handleTogglePermission = (permission) => {
    // Only Super Admin can modify permissions
    if (currentUserRole !== 'Super Admin') {
      setError('Only Super Admins can modify permissions')
      return
    }

    setSelectedPermissions(prev => {
      if (prev.includes(permission)) {
        return prev.filter(p => p !== permission)
      } else {
        return [...prev, permission]
      }
    })
  }

  const handleSelectAll = () => {
    if (currentUserRole !== 'Super Admin') {
      setError('Only Super Admins can modify permissions')
      return
    }
    setSelectedPermissions([...ALL_PERMISSIONS])
  }

  const handleDeselectAll = () => {
    if (currentUserRole !== 'Super Admin') {
      setError('Only Super Admins can modify permissions')
      return
    }
    setSelectedPermissions([])
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    
    try {
      const token = localStorage.getItem('access_token')
      
      const updateData = {
        permissions: selectedPermissions
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
        
        // Immediately refresh current user's data if they modified their own permissions
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
        if (currentUser.id === user.id) {
          try {
            const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420'
              }
            })
            if (meResponse.ok) {
              const updatedUser = await meResponse.json()
              localStorage.setItem('user', JSON.stringify(updatedUser))
              // Trigger a custom event to notify Layout component
              window.dispatchEvent(new CustomEvent('permissionsChanged'))
            }
          } catch (err) {
            console.error('Failed to refresh user data:', err)
          }
        }
        
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

  // Categorized permissions for better organization
  const permissionCategories = [
    {
      category: 'Products',
      permissions: [
        { key: 'view_products', title: 'View Products', description: 'View product data' },
        { key: 'add_products', title: 'Add Products', description: 'Create new products' },
        { key: 'edit_products', title: 'Edit Products', description: 'Modify existing products' },
        { key: 'delete_products', title: 'Delete Products', description: 'Remove products from system' }
      ]
    },
    {
      category: 'COA (Certificate of Analysis)',
      permissions: [
        { key: 'view_coa', title: 'View COA Database', description: 'View COA list and details' },
        { key: 'add_coa', title: 'Add COA', description: 'Create new COA entries' },
        { key: 'edit_coa', title: 'Edit COA', description: 'Modify existing COA entries' },
        { key: 'delete_coa', title: 'Delete COA', description: 'Remove COA entries from system' },
        { key: 'use_coa_in_formulation', title: 'Use in Formulation', description: 'Use COA data in formulation calculations' }
      ]
    },
    {
      category: 'User Management',
      permissions: [
        { key: 'view_users', title: 'View Users', description: 'View user list and details' },
        { key: 'add_users', title: 'Add Users', description: 'Create new user accounts' },
        { key: 'edit_users', title: 'Edit Users', description: 'Modify user information' },
        { key: 'delete_users', title: 'Delete Users', description: 'Remove users from system' },
        { key: 'manage_permissions', title: 'Manage Permissions', description: 'Assign and modify user permissions' }
      ]
    },
    {
      category: 'Nomenclature',
      permissions: [
        { key: 'view_nomenclature', title: 'View Nomenclature', description: 'View nomenclature mappings' },
        { key: 'edit_nomenclature', title: 'Edit Nomenclature', description: 'Modify nomenclature mappings' }
      ]
    },
    {
      category: 'Analysis & Reporting',
      permissions: [
        { key: 'run_comparisons', title: 'Run Comparisons', description: 'Access comparison features' },
        { key: 'view_analytics', title: 'View Analytics', description: 'Access analytics dashboard' },
        { key: 'export_data', title: 'Export Data', description: 'Export reports and data' }
      ]
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
          <div className="bg-white border border-[#e1e7ef] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#0f1729]" />
                <h3 className="text-sm font-ibm-plex font-semibold text-[#0f1729]">
                  Permissions ({selectedPermissions.length}/{ALL_PERMISSIONS.length})
                </h3>
              </div>
              {currentUserRole === 'Super Admin' && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-[#009da5] hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-[#65758b]">|</span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-xs text-[#65758b] hover:text-[#0f1729] hover:underline font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>

            {permissionCategories.map((category, catIndex) => (
              <div key={category.category} className="mb-4">
                <h4 className="text-xs font-ibm-plex font-semibold text-[#65758b] mb-2 uppercase tracking-wider">
                  {category.category}
                </h4>
                <div className="space-y-1">
                  {category.permissions.map((perm) => (
                    <label
                      key={perm.key}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                        currentUserRole === 'Super Admin' ? 'hover:bg-gray-50 cursor-pointer' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm.key)}
                        onChange={() => handleTogglePermission(perm.key)}
                        disabled={currentUserRole !== 'Super Admin'}
                        className="mt-0.5 w-4 h-4 text-[#009da5] border-gray-300 rounded focus:ring-[#009da5] disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-0.5">
                          {perm.title}
                        </div>
                        <div className="text-xs font-ibm-plex text-[#65758b]">
                          {perm.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {catIndex !== permissionCategories.length - 1 && (
                  <div className="h-px bg-[#e1e7ef] my-3" />
                )}
              </div>
            ))}

            {currentUserRole !== 'Super Admin' && (
              <p className="text-xs font-ibm-plex text-[#65758b] pt-2 border-t border-[#e1e7ef]">
                Only Super Admins can modify permissions.
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

