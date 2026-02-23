import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import AddUserModal from '../components/Modals/AddUserModal'
import PermissionsPanel from '../components/Modals/PermissionsPanel'
import NoPermissionContent from '../components/NoPermissionContent'
import { Search, ChevronDown, MoreVertical, UserPlus, Bell, User, CheckCircle, AlertCircle } from 'lucide-react'
import authService from '../services/api'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const Users = () => {
  const navigate = useNavigate()
  const hasPermission = authService.hasPermission('view_users')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState('All roles')
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showPermissionsPanel, setShowPermissionsPanel] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const roleDropdownRef = useRef(null)

  // Get current user from localStorage
  const currentUser = authService.getCurrentUser()
  const currentUserRole = currentUser?.role || 'Researcher'

  const [users, setUsers] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [showPendingTab, setShowPendingTab] = useState(false)

  const roles = ['All roles', 'Super Admin', 'Admin', 'Researcher']

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('access_token')
      
      if (!token) {
        navigate('/login')
        return
      }

      const response = await fetch(`${API_BASE_URL}/users?page=1&page_size=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (response.status === 401) {
        localStorage.clear()
        navigate('/login')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      
      // Transform API data to match frontend format
      const transformedUsers = data.users.map(user => ({
        id: user.id,
        name: user.name,
        initials: user.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        email: user.email,
        department: user.department || 'N/A',
        role: user.role,
        status: user.is_active ? 'Active' : 'Deactivated',
        isActive: user.is_active,
        isApproved: user.is_approved,
        permissions: user.permissions
      }))

      setUsers(transformedUsers)
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('Failed to load users. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch pending users
  const fetchPendingUsers = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/users/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const transformedPending = data.map(user => ({
          id: user.id,
          name: user.name,
          initials: user.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          email: user.email,
          department: user.department || 'N/A',
          role: user.role,
          status: 'Pending Approval',
          isActive: user.is_active,
          isApproved: false,
          permissions: user.permissions
        }))
        setPendingUsers(transformedPending)
      }
    } catch (err) {
      console.error('Error fetching pending users:', err)
    }
  }

  useEffect(() => {
    fetchUsers()
    if (currentUserRole === 'Super Admin') {
      fetchPendingUsers()
    }
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target)) {
        setShowRoleDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter users based on search and role
  const displayUsers = showPendingTab ? pendingUsers : users
  const filteredUsers = displayUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = selectedRole === 'All roles' || user.role === selectedRole
    return matchesSearch && matchesRole
  })

  // Role badge colors
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

  // Status badge colors
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-[#e4fbed] text-[#16a249]'
      case 'Deactivated':
        return 'bg-[rgba(239,67,67,0.1)] text-[#ef4343]'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  // Show success message temporarily
  const showSuccess = (message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  // Handle approve user
  const handleApproveUser = async (userId) => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/users/${userId}/approve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        showSuccess('User approved successfully!')
        fetchUsers()
        fetchPendingUsers()
        setActiveDropdown(null)
      } else {
        const error = await response.json()
        setError(error.detail || 'Failed to approve user')
      }
    } catch (err) {
      setError('Failed to approve user. Please try again.')
    }
  }

  // Handle toggle user status
  const handleToggleStatus = async (userId) => {
    // Permission check: Only Super Admin and Admin can toggle status
    if (currentUserRole === 'Researcher') {
      setError('You do not have permission to change user status')
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/users/${userId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        showSuccess('User status updated successfully!')
        fetchUsers()
      } else {
        const error = await response.json()
        setError(error.detail || 'Failed to update user status')
      }
    } catch (err) {
      setError('Failed to update user status. Please try again.')
    }
  }

  // Handle view permissions
  const handleViewPermissions = (user) => {
    setSelectedUser(user)
    setShowPermissionsPanel(true)
    setActiveDropdown(null)
  }

  // Update selected user after permissions change
  const handlePermissionsUpdate = async () => {
    await fetchUsers()
    // Find and update the selected user with fresh data
    if (selectedUser) {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const userData = await response.json()
        const updatedUser = {
          id: userData.id,
          name: userData.name,
          initials: userData.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          email: userData.email,
          department: userData.department || 'N/A',
          role: userData.role,
          status: userData.is_active ? 'Active' : 'Deactivated',
          isActive: userData.is_active,
          isApproved: userData.is_approved,
          permissions: userData.permissions
        }
        setSelectedUser(updatedUser)
      }
    }
  }

  // Handle deactivate user
  const handleDeactivateUser = async (userId) => {
    // Permission check: Only Super Admin and Admin can deactivate
    if (currentUserRole === 'Researcher') {
      setError('You do not have permission to deactivate users')
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/users/${userId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        showSuccess('User deactivated successfully!')
        fetchUsers()
        setActiveDropdown(null)
      } else {
        const error = await response.json()
        setError(error.detail || 'Failed to deactivate user')
      }
    } catch (err) {
      setError('Failed to deactivate user. Please try again.')
    }
  }

  // Handle remove user
  const handleRemoveUser = async (userId) => {
    // Permission check: Only Super Admin can delete users
    if (currentUserRole !== 'Super Admin') {
      setError('Only Super Admins can remove users')
      return
    }

    if (confirm('Are you sure you want to remove this user? This action cannot be undone.')) {
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          showSuccess('User removed successfully!')
          fetchUsers()
          setActiveDropdown(null)
        } else {
          const error = await response.json()
          setError(error.detail || 'Failed to remove user')
        }
      } catch (err) {
        setError('Failed to remove user. Please try again.')
      }
    }
  }

  // Handle add user
  const handleAddUser = () => {
    // Permission check: Only Super Admin and Admin can add users
    if (currentUserRole === 'Researcher') {
      setError('You do not have permission to add users')
      return
    }

    setShowAddUserModal(true)
  }

  const handleCreateUser = async (newUser) => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
      })

      if (response.ok) {
        showSuccess('User created successfully!')
        fetchUsers()
        setShowAddUserModal(false)
      } else {
        const error = await response.json()
        setError(error.detail || 'Failed to create user')
      }
    } catch (err) {
      setError('Failed to create user. Please try again.')
    }
  }

  return (
    <Layout>
      {!hasPermission ? (
        <NoPermissionContent pageName="User Management" />
      ) : (
        <div className="p-4 md:p-6 h-full flex flex-col">
          {/* Success Message */}
        {successMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-ibm-plex">{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-ibm-plex">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">×</button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
              Users
            </h1>
            <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">
              Manage users and permissions for the platform
            </p>
          </div>
          <button
            onClick={handleAddUser}
            className="bg-[#009da5] flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#008891] transition-colors whitespace-nowrap w-full sm:w-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>

        {/* Tabs for Pending Approval */}
        {currentUserRole === 'Super Admin' && pendingUsers.length > 0 && (
          <div className="flex gap-2 mb-4 border-b border-[#e1e7ef]">
            <button
              onClick={() => setShowPendingTab(false)}
              className={`px-4 py-2 text-sm font-ibm-plex font-medium border-b-2 transition-colors ${
                !showPendingTab
                  ? 'border-[#009da5] text-[#009da5]'
                  : 'border-transparent text-[#65758b] hover:text-[#0f1729]'
              }`}
            >
              All Users ({users.length})
            </button>
            <button
              onClick={() => setShowPendingTab(true)}
              className={`px-4 py-2 text-sm font-ibm-plex font-medium border-b-2 transition-colors relative ${
                showPendingTab
                  ? 'border-[#009da5] text-[#009da5]'
                  : 'border-transparent text-[#65758b] hover:text-[#0f1729]'
              }`}
            >
              Pending Approval ({pendingUsers.length})
              {pendingUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {pendingUsers.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#65758b]" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Role Filter Dropdown */}
            <div className="relative w-full sm:w-56" ref={roleDropdownRef}>
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md flex items-center justify-between text-sm font-ibm-plex text-[#0f1729] hover:bg-gray-50 transition-colors"
              >
                <span className="truncate">{selectedRole}</span>
                <ChevronDown className="w-4 h-4 text-[#65758b] flex-shrink-0" />
              </button>
              
              {showRoleDropdown && (
                <div className="absolute top-full mt-1 w-full bg-white border border-[#e1e7ef] rounded-md shadow-lg z-50 py-1">
                  {roles.map((role) => (
                    <button
                      key={role}
                      onClick={() => {
                        setSelectedRole(role)
                        setShowRoleDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm font-ibm-plex text-[#0f1729] hover:bg-[#f9fafb] transition-colors"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white border border-[#e1e7ef] rounded-lg shadow-sm overflow-hidden flex-1 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#009da5] mx-auto mb-4"></div>
                <p className="text-sm font-ibm-plex text-[#65758b]">Loading users...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-sm font-ibm-plex text-[#65758b]">
                  {showPendingTab ? 'No pending approvals' : 'No users found'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-auto flex-1">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[rgba(241,245,249,0.5)] border-b border-[#e1e7ef] sticky top-0 z-10">
                      <th className="px-4 py-4 text-left">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          User Name
                        </span>
                      </th>
                      <th className="px-4 py-4 text-left">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Email
                        </span>
                      </th>
                      <th className="px-4 py-4 text-left">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Role
                        </span>
                      </th>
                      <th className="px-4 py-4 text-left">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Status
                        </span>
                      </th>
                      <th className="px-4 py-4 text-right">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Actions
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-[#e1e7ef] hover:bg-[#f9fafb]/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#f1f5f9] flex items-center justify-center">
                          <span className="text-xs font-ibm-plex font-semibold text-[#0f1729]">
                            {user.initials}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                            {user.name}
                          </div>
                          <div className="text-sm font-ibm-plex text-[#65758b]">
                            {user.department}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-ibm-plex text-[#65758b]">
                        {user.email}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-ibm-plex font-semibold ${getRoleBadgeStyle(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-ibm-plex font-semibold ${
                          !user.isApproved 
                            ? 'bg-amber-100 text-amber-800'
                            : getStatusBadgeStyle(user.status)
                        }`}>
                          {!user.isApproved ? 'Pending Approval' : user.status}
                        </span>
                        {/* Toggle Switch - only show if approved */}
                        {user.isApproved && (
                          <button
                            onClick={() => handleToggleStatus(user.id)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              user.isActive ? 'bg-[#009da5]' : 'bg-[#e1e7ef]'
                            }`}
                            title={`Toggle ${user.name}'s status`}
                          >
                            <div
                              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                                user.isActive ? 'translate-x-[22px]' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end relative">
                        <button
                          onClick={() => setActiveDropdown(activeDropdown === user.id ? null : user.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                          title="More actions"
                        >
                          <MoreVertical className="w-4 h-4 text-[#65758b]" />
                        </button>

                        {/* Actions Dropdown */}
                        {activeDropdown === user.id && (
                          <div className="absolute right-0 top-10 bg-white border border-[#e1e7ef] rounded-md shadow-lg z-50 min-w-[160px] py-1">
                            {/* Approve button for pending users */}
                            {!user.isApproved && currentUserRole === 'Super Admin' && (
                              <>
                                <button
                                  onClick={() => handleApproveUser(user.id)}
                                  className="w-full px-3 py-2 text-left text-sm font-ibm-plex text-green-600 hover:bg-green-50 transition-colors flex items-center gap-2"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve User
                                </button>
                                <div className="h-px bg-[#f1f5f9] my-1" />
                              </>
                            )}
                            
                            <button
                              onClick={() => handleViewPermissions(user)}
                              className="w-full px-3 py-2 text-left text-sm font-ibm-plex text-[#0f1729] hover:bg-[#f9fafb] transition-colors"
                            >
                              View permissions
                            </button>
                            
                            {user.isApproved && (currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && (
                              <button
                                onClick={() => handleDeactivateUser(user.id)}
                                className="w-full px-3 py-2 text-left text-sm font-ibm-plex text-[#0f1729] hover:bg-[#f9fafb] transition-colors"
                                disabled={!user.isActive}
                              >
                                {user.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}

                            <div className="h-px bg-[#f1f5f9] my-1" />
                            
                            {currentUserRole === 'Super Admin' && (
                              <button
                                onClick={() => handleRemoveUser(user.id)}
                                className="w-full px-3 py-2 text-left text-sm font-ibm-plex text-[#ef4343] hover:bg-red-50 transition-colors"
                              >
                                Remove user
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer - Pagination */}
              <div className="border-t border-[#e1e7ef] px-4 py-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-ibm-plex text-[#65758b]">
                    Showing <span className="font-medium text-[#0f1729]">1</span>–
                    <span className="font-medium text-[#0f1729]">{filteredUsers.length}</span> of{' '}
                    <span className="font-medium text-[#0f1729]">{filteredUsers.length}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-ibm-plex font-medium text-[#0f1729] opacity-50 cursor-not-allowed">
                      <span>Previous</span>
                    </button>
                    <button className="w-10 h-10 flex items-center justify-center rounded-md bg-[#f9fafb] border border-[#e1e7ef] text-sm font-ibm-plex font-medium text-[#0f1729]">
                      1
                    </button>
                    <button className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-ibm-plex font-medium text-[#0f1729] opacity-50 cursor-not-allowed">
                      <span>Next</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modals */}
        <AddUserModal
          isOpen={showAddUserModal}
          onClose={() => setShowAddUserModal(false)}
          onSave={handleCreateUser}
          currentUserRole={currentUserRole}
        />

        <PermissionsPanel
          isOpen={showPermissionsPanel}
          onClose={() => setShowPermissionsPanel(false)}
          user={selectedUser}
          currentUserRole={currentUserRole}
          onUpdate={handlePermissionsUpdate}
        />
      </div>
      )}
    </Layout>
  )
}

export default Users

