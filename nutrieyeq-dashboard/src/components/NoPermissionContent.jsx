import { ShieldAlert, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import authService from '../services/api'

const NoPermissionContent = ({ pageName = 'this page' }) => {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await authService.getCurrentUserInfo()
      // Reload page to apply new permissions
      window.location.reload()
    } catch (error) {
      console.error('Failed to refresh:', error)
      setRefreshing(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="max-w-md w-full text-center px-4">
        {/* Icon */}
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-amber-600" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-ibm-plex font-bold text-[#0f1729] mb-3">
          Oops! No Permission
        </h1>

        {/* Message */}
        <p className="text-base font-poppins text-[#65758b] mb-2">
          You don't have permission to access {pageName}.
        </p>
        <p className="text-sm font-poppins text-[#65758b] mb-6">
          Please contact your administrator if you believe this is an error.
        </p>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="mx-auto px-4 py-2 bg-[#b455a0] text-white rounded-lg font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Checking...' : 'Check Permissions'}
        </button>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-xs font-poppins text-blue-900">
            <strong>Need Access?</strong> Contact your Super Admin to request permissions for this feature.
          </p>
          <p className="text-xs font-poppins text-blue-700 mt-2">
            If you've been granted access, click "Check Permissions" above to refresh.
          </p>
        </div>
      </div>
    </div>
  )
}

export default NoPermissionContent

