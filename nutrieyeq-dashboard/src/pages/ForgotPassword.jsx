import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, Brain, BarChart3, Mail } from 'lucide-react'
import { authService } from '../services/api'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const features = [
    {
      icon: Upload,
      title: 'Easy Upload',
      description: 'Upload product data in seconds'
    },
    {
      icon: Brain,
      title: 'Smart Scan',
      description: 'AI-powered product analysis'
    },
    {
      icon: BarChart3,
      title: 'Compare Products',
      description: 'Side-by-side NutriEyeQ'
    }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authService.forgotPassword(email)
      
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error || 'Failed to send reset OTP')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
          <p className="text-gray-600 mb-6">
            If an account exists for {email}, we've sent a password reset OTP to your email.
          </p>
          <Link
            to="/reset-password"
            className="inline-block w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-3"
          >
            Enter OTP & Reset Password
          </Link>
          <Link
            to="/login"
            className="inline-block text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-gradient-to-r from-[#f9fafb] to-white">
      {/* Left Side - Gradient Background with Features */}
      <div 
        className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-[#b455a0] to-[#0f2c2e] items-center justify-center p-6 xl:p-12"
      >
        <div className="w-full max-w-xl px-4">
          <div className="space-y-6 xl:space-y-8">
            {/* Logo */}
            <div className="mb-6">
              <img
                src="/assets/zydus-logo.png"
                alt="Zydus Wellness Logo"
                className="h-16 w-auto object-contain"
              />
            </div>

            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-3xl xl:text-5xl font-['IBM_Plex_Sans'] font-bold text-white leading-tight">
                Your NutriEyeQ Kickoff
                <br />
                Dashboard, Simplified.
              </h1>
              <p className="text-[16px] xl:text-[18px] text-white/80 font-poppins leading-[1.6]">
                Track, upload, and compare products effortlessly.
                <br />
                Your journey to smarter competition analysis starts here.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <div key={index} className="flex items-center gap-4">
                    <div className="bg-white/20 rounded-xl p-3 flex items-center justify-center w-12 h-12 flex-shrink-0">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-poppins font-semibold text-white">
                        {feature.title}
                      </h3>
                      <p className="text-sm font-poppins text-white/70">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center bg-[#f3f3f3] p-4 sm:p-6 md:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-6 md:space-y-8">
          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] border border-[rgba(225,231,239,0.5)] p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6 md:mb-8">
              <h2 className="text-xl sm:text-2xl font-poppins font-bold text-[#0f1729] mb-2">
                Forgot Password?
              </h2>
              <p className="text-sm sm:text-base font-poppins text-[#65758b]">
                Enter your email to receive a reset OTP
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-poppins mb-5">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <Mail className="w-5 h-5 text-[#9ca3af]" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 bg-[#f9fafb] border-0 rounded-xl pl-12 pr-4 text-sm font-poppins text-[#0f1729] placeholder-[#9ca3af] focus:ring-2 focus:ring-[#b455a0] focus:bg-white transition-all"
                  placeholder="Email or Phone"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#b455a0] text-white rounded-xl font-poppins font-medium text-base shadow-sm hover:bg-[#9d4a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending OTP...' : 'Send Reset OTP'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e1e7ef]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-4 text-[#65758b] font-poppins font-medium uppercase">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Microsoft Button */}
            <button
              type="button"
              className="w-full h-12 bg-white border border-[#e1e7ef] text-[#0f1729] rounded-xl font-poppins font-medium text-base hover:bg-[#f9fafb] transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
                <path d="M11 11H0V0h11v11z" fill="#F25022"/>
                <path d="M23 11H12V0h11v11z" fill="#00A4EF"/>
                <path d="M11 23H0V12h11v11z" fill="#7FBA00"/>
                <path d="M23 23H12V12h11v11z" fill="#FFB900"/>
              </svg>
              <span>Continue with Microsoft</span>
            </button>

            {/* Terms */}
            <p className="text-[11px] sm:text-xs font-poppins text-[#65758b] text-center mt-5 md:mt-6 px-2">
              By continuing, you agree to our{' '}
              <span className="text-[#3c83f6]">Terms of Service</span> and{' '}
              <span className="text-[#3c83f6]">Privacy Policy</span>
            </p>

            {/* Login Link */}
            <div className="mt-4 text-center text-sm font-poppins text-[#65758b]">
              Remember your password?{' '}
              <Link to="/login" className="text-[#3c83f6] font-medium hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
