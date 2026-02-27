import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Upload, Brain, BarChart3, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { authService } from '../services/api'

const ResetPassword = () => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  })

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      const result = await authService.resetPassword(
        formData.email,
        formData.otp,
        formData.newPassword
      )

      if (result.success) {
        alert('Password reset successful! You can now login with your new password.')
        navigate('/login')
      } else {
        setError(result.error || 'Password reset failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
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
                Reset Password
              </h2>
              <p className="text-sm sm:text-base font-poppins text-[#65758b]">
                Enter the OTP sent to your email
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
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full h-12 bg-[#f9fafb] border-0 rounded-xl pl-12 pr-4 text-sm font-poppins text-[#0f1729] placeholder-[#9ca3af] focus:ring-2 focus:ring-[#b455a0] focus:bg-white transition-all"
                  placeholder="Email"
                />
              </div>

              {/* OTP Input */}
              <div className="relative">
                <input
                  type="text"
                  name="otp"
                  value={formData.otp}
                  onChange={handleChange}
                  required
                  maxLength={6}
                  className="w-full h-12 bg-[#f9fafb] border-0 rounded-xl px-4 text-sm font-poppins text-[#0f1729] placeholder-[#9ca3af] focus:ring-2 focus:ring-[#b455a0] focus:bg-white transition-all text-center text-xl tracking-widest"
                  placeholder="123456"
                />
              </div>

              {/* New Password Input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <Lock className="w-5 h-5 text-[#9ca3af]" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  className="w-full h-12 bg-[#f9fafb] border-0 rounded-xl pl-12 pr-12 text-sm font-poppins text-[#0f1729] placeholder-[#9ca3af] focus:ring-2 focus:ring-[#b455a0] focus:bg-white transition-all"
                  placeholder="New Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9ca3af] hover:text-[#65758b]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Confirm Password Input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <Lock className="w-5 h-5 text-[#9ca3af]" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full h-12 bg-[#f9fafb] border-0 rounded-xl pl-12 pr-12 text-sm font-poppins text-[#0f1729] placeholder-[#9ca3af] focus:ring-2 focus:ring-[#b455a0] focus:bg-white transition-all"
                  placeholder="Confirm Password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9ca3af] hover:text-[#65758b]"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#b455a0] text-white rounded-xl font-poppins font-medium text-base shadow-sm hover:bg-[#9d4a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>

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

export default ResetPassword
