import { useState } from 'react'
import { X, UserPlus } from 'lucide-react'

const AddUserModal = ({ isOpen, onClose, onSave, currentUserRole }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    role: 'Researcher',
    password: '',
    confirmPassword: ''
  })

  const roles = ['Super Admin', 'Admin', 'Researcher']

  const handleSubmit = (e) => {
    e.preventDefault()

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      alert('Please fill in all required fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email address')
      return
    }

    // Permission check: Only Super Admin can create Super Admin users
    if (formData.role === 'Super Admin' && currentUserRole !== 'Super Admin') {
      alert('Only Super Admins can create Super Admin users')
      return
    }

    // Save user
    onSave({
      name: formData.name,
      email: formData.email,
      department: formData.department || null,
      role: formData.role,
      password: formData.password
    })

    // Reset form and close
    setFormData({
      name: '',
      email: '',
      department: '',
      role: 'Researcher',
      password: '',
      confirmPassword: ''
    })
    onClose()
  }

  const handleCancel = () => {
    setFormData({
      name: '',
      email: '',
      department: '',
      role: 'Researcher',
      password: '',
      confirmPassword: ''
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e1e7ef]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#009da5]/10 rounded-full flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-[#009da5]" />
            </div>
            <div>
              <h2 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
                Add New User
              </h2>
              <p className="text-sm font-ibm-plex text-[#65758b]">
                Create a new user account
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-[#65758b]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
              Full Name *
            </label>
            <input
              type="text"
              placeholder="Enter full name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
              Email *
            </label>
            <input
              type="email"
              placeholder="user@wellnessco.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              required
            />
          </div>

          {/* Department */}
          <div>
            <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
              Department
            </label>
            <input
              type="text"
              placeholder="e.g., Product Team, R&D"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
              Role *
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              required
            >
              {roles.map((role) => (
                <option 
                  key={role} 
                  value={role}
                  disabled={role === 'Super Admin' && currentUserRole !== 'Super Admin'}
                >
                  {role} {role === 'Super Admin' && currentUserRole !== 'Super Admin' ? '(Restricted)' : ''}
                </option>
              ))}
            </select>
            {formData.role === 'Super Admin' && currentUserRole !== 'Super Admin' && (
              <p className="text-xs font-ibm-plex text-[#ef4343] mt-1">
                Only Super Admins can create Super Admin users
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
              Password *
            </label>
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              required
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
              Confirm Password *
            </label>
            <input
              type="password"
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              required
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 h-10 px-4 py-2 border border-[#e1e7ef] rounded-md text-sm font-ibm-plex font-medium text-[#0f1729] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-10 px-4 py-2 bg-[#009da5] rounded-md text-sm font-ibm-plex font-medium text-white hover:bg-[#008891] transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddUserModal

