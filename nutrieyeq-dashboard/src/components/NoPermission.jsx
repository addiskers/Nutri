import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const NoPermission = ({ pageName = 'this page' }) => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f3f3f3] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-[#e1e7ef] p-8 text-center">
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

        {/* Divider */}
        <div className="h-px bg-[#e1e7ef] my-6" />

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full h-11 bg-[#b455a0] text-white rounded-lg font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors flex items-center justify-center gap-2"
          >
            Go to Dashboard
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className="w-full h-11 bg-white border border-[#e1e7ef] text-[#0f1729] rounded-lg font-ibm-plex font-medium text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs font-poppins text-blue-900">
            <strong>Need Access?</strong> Contact your Super Admin to request permissions for this feature.
          </p>
        </div>
      </div>
    </div>
  )
}

export default NoPermission





