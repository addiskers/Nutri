import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { User, Lock, Mail, Briefcase, Shield, Calendar, CheckCircle, AlertCircle } from 'lucide-react'
import authService from '../services/api'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const SettingsPage = () => {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      
      if (!token) {
        navigate('/login')
        return
      }

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
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
        throw new Error('Failed to fetch profile')
      }

      const data = await response.json()
      setCurrentUser(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Failed to load profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long')
      return
    }

    try {
      setChangingPassword(true)
      const token = localStorage.getItem('access_token')

      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        setPasswordSuccess('Password changed successfully!')
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      } else {
        setPasswordError(data.detail || 'Failed to change password')
      }
    } catch (err) {
      console.error('Error changing password:', err)
      setPasswordError('Failed to change password. Please try again.')
    } finally {
      setChangingPassword(false)
    }
  }

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'Admin':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'Researcher':
        return 'bg-green-100 text-green-700 border-green-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-ibm-plex font-bold text-[#0f1729]">Profile & Settings</h1>
          <p className="text-sm text-[#60758a] mt-1">Manage your account information and security settings</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white border border-[#e1e7ef] rounded-lg p-6">
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-[#0f2c2e] flex items-center justify-center mb-4">
                  <span className="text-2xl font-ibm-plex font-bold text-white">
                    {getInitials(currentUser?.name)}
                  </span>
                </div>
                <h2 className="text-xl font-ibm-plex font-bold text-[#0f1729] text-center">
                  {currentUser?.name}
                </h2>
                <p className="text-sm text-[#60758a] mt-1">{currentUser?.email}</p>
                <div className={`mt-3 px-3 py-1 rounded-full border text-xs font-medium ${getRoleBadgeColor(currentUser?.role)}`}>
                  {currentUser?.role}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-[#e1e7ef] space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="w-4 h-4 text-[#60758a]" />
                  <span className="text-[#60758a]">Department:</span>
                  <span className="font-medium text-[#0f1729] ml-auto">{currentUser?.department || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="w-4 h-4 text-[#60758a]" />
                  <span className="text-[#60758a]">Status:</span>
                  <span className={`font-medium ml-auto ${currentUser?.is_active ? 'text-green-600' : 'text-red-600'}`}>
                    {currentUser?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-[#60758a]" />
                  <span className="text-[#60758a]">Joined:</span>
                  <span className="font-medium text-[#0f1729] ml-auto">
                    {currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-[#e1e7ef] rounded-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">Account Information</h3>
                  <p className="text-sm text-[#60758a]">Your personal details</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#0f1729] mb-2">Full Name</label>
                  <input
                    type="text"
                    value={currentUser?.name || ''}
                    disabled
                    className="w-full px-4 py-2 border border-[#e1e7ef] rounded-lg bg-gray-50 text-[#60758a] cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0f1729] mb-2">Email Address</label>
                  <input
                    type="email"
                    value={currentUser?.email || ''}
                    disabled
                    className="w-full px-4 py-2 border border-[#e1e7ef] rounded-lg bg-gray-50 text-[#60758a] cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0f1729] mb-2">Department</label>
                  <input
                    type="text"
                    value={currentUser?.department || 'Not specified'}
                    disabled
                    className="w-full px-4 py-2 border border-[#e1e7ef] rounded-lg bg-gray-50 text-[#60758a] cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#e1e7ef] rounded-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">Change Password</h3>
                  <p className="text-sm text-[#60758a]">Update your password to keep your account secure</p>
                </div>
              </div>

              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{passwordError}</p>
                </div>
              )}

              {passwordSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800">{passwordSuccess}</p>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#0f1729] mb-2">Current Password</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-[#e1e7ef] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0f1729] mb-2">New Password</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-[#e1e7ef] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter new password (min 8 characters)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0f1729] mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-[#e1e7ef] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Confirm new password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {changingPassword ? 'Changing Password...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default SettingsPage








