import { useState, useEffect } from 'react'
import { X, Users, Copy, ArrowRight, CheckCircle, AlertCircle, Search, Filter } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const TransferFormulationModal = ({ isOpen, onClose, formulations = [], onTransferComplete }) => {
  const [users, setUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [transferType, setTransferType] = useState('copy')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
      setSearchQuery('')
      setRoleFilter('All')
      setSelectedUsers([])
    }
  }, [isOpen])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/users?page=1&page_size=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users.filter(u => u.is_active && u.is_approved))
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('Failed to load users')
    }
  }

  const handleUserToggle = (userEmail) => {
    setSelectedUsers(prev => 
      prev.includes(userEmail) 
        ? prev.filter(e => e !== userEmail)
        : [...prev, userEmail]
    )
  }

  const handleSelectAll = () => {
    const filteredUserEmails = getFilteredUsers().map(u => u.email)
    setSelectedUsers(filteredUserEmails)
  }

  const handleDeselectAll = () => {
    setSelectedUsers([])
  }

  const getFilteredUsers = () => {
    return users.filter(user => {
      const matchesSearch = searchQuery === '' || 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesRole = roleFilter === 'All' || user.role === roleFilter
      
      return matchesSearch && matchesRole
    })
  }

  const handleTransfer = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user')
      return
    }

    if (formulations.length === 0) {
      setError('No formulations selected')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('access_token')
      let successCount = 0
      let errorCount = 0

      // Transfer each formulation
      for (const formulation of formulations) {
        try {
          const response = await fetch(`${API_BASE_URL}/formulations/${formulation.id}/transfer`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': '69420'
            },
            body: JSON.stringify({
              target_users: selectedUsers,
              transfer_type: transferType
            })
          })

          if (response.ok) {
            successCount++
          } else {
            errorCount++
          }
        } catch (err) {
          errorCount++
        }
      }

      if (errorCount === 0) {
        setSuccess(`Successfully transferred ${successCount} formulation(s) to ${selectedUsers.length} user(s)`)
        setTimeout(() => {
          onTransferComplete()
          onClose()
        }, 1500)
      } else if (successCount > 0) {
        setError(`Transferred ${successCount} formulation(s), but ${errorCount} failed`)
      } else {
        setError('All transfers failed')
      }
    } catch (err) {
      console.error('Error transferring formulations:', err)
      setError('Failed to transfer formulations')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#e1e7ef]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-ibm-plex font-bold text-[#0f1729]">
                Transfer {formulations.length > 1 ? `${formulations.length} Formulations` : 'Formulation'}
              </h2>
              <p className="text-sm text-[#60758a]">
                {formulations.length === 1 ? formulations[0]?.name : `${formulations.length} formulations selected`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#60758a]" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-[#0f1729] mb-3">
              Transfer Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTransferType('copy')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  transferType === 'copy'
                    ? 'border-primary bg-primary/5'
                    : 'border-[#e1e7ef] hover:border-primary/50'
                }`}
              >
                <Copy className="w-5 h-5 text-primary mb-2" />
                <div className="text-left">
                  <div className="font-medium text-[#0f1729]">Copy</div>
                  <div className="text-xs text-[#60758a]">Keep original and create copies</div>
                </div>
              </button>
              <button
                onClick={() => setTransferType('move')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  transferType === 'move'
                    ? 'border-primary bg-primary/5'
                    : 'border-[#e1e7ef] hover:border-primary/50'
                }`}
              >
                <ArrowRight className="w-5 h-5 text-primary mb-2" />
                <div className="text-left">
                  <div className="font-medium text-[#0f1729]">Move</div>
                  <div className="text-xs text-[#60758a]">Transfer and remove original</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0f1729] mb-3">
              Select Users ({selectedUsers.length} selected)
            </label>
            
            {/* Search Bar */}
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#60758a]" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#e1e7ef] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            {/* Role Filter */}
            <div className="mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#60758a]" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="flex-1 px-3 py-2 border border-[#e1e7ef] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="All">All Roles</option>
                <option value="Super Admin">Super Admin</option>
                <option value="Admin">Admin</option>
                <option value="Researcher">Researcher</option>
              </select>
            </div>

            {/* Select All / Deselect All */}
            <div className="mb-2 flex gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs text-primary hover:underline font-medium"
              >
                Select All ({getFilteredUsers().length})
              </button>
              <span className="text-xs text-[#60758a]">|</span>
              <button
                onClick={handleDeselectAll}
                className="text-xs text-[#60758a] hover:text-[#0f1729] hover:underline font-medium"
              >
                Deselect All
              </button>
            </div>

            <div className="border border-[#e1e7ef] rounded-lg divide-y divide-[#e1e7ef] max-h-64 overflow-y-auto">
              {getFilteredUsers().length === 0 ? (
                <div className="p-4 text-center text-[#60758a]">
                  {searchQuery || roleFilter !== 'All' ? 'No users match your filters' : 'No users available'}
                </div>
              ) : (
                getFilteredUsers().map(user => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.email)}
                      onChange={() => handleUserToggle(user.email)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[#0f1729]">{user.name}</div>
                      <div className="text-sm text-[#60758a]">{user.email}</div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      user.role === 'Super Admin' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'Admin' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {user.role}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e1e7ef] bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#60758a] hover:text-[#0f1729] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={loading || selectedUsers.length === 0}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Transferring...' : `${transferType === 'copy' ? 'Copy' : 'Move'} to ${selectedUsers.length} User(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TransferFormulationModal
