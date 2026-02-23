import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../services/api'

const AuthCallback = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('processing')
  const [message, setMessage] = useState('Completing sign-in...')
  const hasProcessed = useRef(false)

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent duplicate processing in React StrictMode
      if (hasProcessed.current) return
      hasProcessed.current = true
      // Get code and state from URL
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Handle OAuth errors
      if (error) {
        setStatus('error')
        setMessage(errorDescription || 'Authentication failed. Please try again.')
        setTimeout(() => navigate('/login'), 3000)
        return
      }

      // Validate code
      if (!code) {
        setStatus('error')
        setMessage('Invalid authentication response. Please try again.')
        setTimeout(() => navigate('/login'), 3000)
        return
      }

      // Verify state (CSRF protection)
      const storedState = sessionStorage.getItem('azure_state')
      if (state && storedState && state !== storedState) {
        setStatus('error')
        setMessage('Security validation failed. Please try again.')
        sessionStorage.removeItem('azure_state')
        setTimeout(() => navigate('/login'), 3000)
        return
      }

      // Exchange code for tokens
      try {
        const result = await authService.azureCallback(code, state)

        if (result.success && result.user) {
          // Successfully authenticated and approved
          setStatus('success')
          setMessage('Sign-in successful! Redirecting to dashboard...')
          sessionStorage.removeItem('azure_state')
          setTimeout(() => navigate('/dashboard'), 1000)
        } else if (result.pending) {
          // User pending approval
          setStatus('pending')
          setMessage(result.message || 'Your account is pending approval.')
          sessionStorage.removeItem('azure_state')
        } else {
          // Authentication failed
          setStatus('error')
          setMessage(result.error || 'Authentication failed. Please try again.')
          setTimeout(() => navigate('/login'), 3000)
        }
      } catch (err) {
        console.error('Callback error:', err)
        setStatus('error')
        setMessage('An error occurred during sign-in. Please try again.')
        setTimeout(() => navigate('/login'), 3000)
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f9fafb] to-white">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/src/assets/zydus-logo.png"
              alt="Zydus Wellness Logo"
              className="h-12 w-auto object-contain"
            />
          </div>

          {status === 'processing' && (
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#b455a0]"></div>
              </div>
              <h3 className="text-lg font-poppins font-semibold text-[#0f1729] mb-2">
                Processing Sign-In
              </h3>
              <p className="text-sm font-poppins text-[#65758b]">
                {message}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-poppins font-semibold text-green-700 mb-2">
                Sign-In Successful
              </h3>
              <p className="text-sm font-poppins text-[#65758b]">
                {message}
              </p>
            </div>
          )}

          {status === 'pending' && (
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-poppins font-semibold text-amber-700 mb-2">
                Account Pending Approval
              </h3>
              <p className="text-sm font-poppins text-[#65758b] mb-4">
                {message}
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-xs font-poppins text-amber-900">
                  A Super Admin will review your request and activate your account. 
                  Please check back later or contact your administrator.
                </p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full h-10 bg-[#b455a0] text-white rounded-lg font-poppins font-medium text-sm hover:bg-[#a04890] transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-poppins font-semibold text-red-700 mb-2">
                Authentication Failed
              </h3>
              <p className="text-sm font-poppins text-[#65758b] mb-4">
                {message}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full h-10 bg-[#b455a0] text-white rounded-lg font-poppins font-medium text-sm hover:bg-[#a04890] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthCallback
