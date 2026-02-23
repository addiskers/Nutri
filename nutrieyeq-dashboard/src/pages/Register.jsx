import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Upload, Brain, BarChart3, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { authService } from '../services/api'

const Register = () => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingApproval, setPendingApproval] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: ''
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
    setLoading(true)

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    try {
      const result = await authService.register(
        formData.name,
        formData.email,
        formData.password,
        formData.department
      )

      if (result.success) {
        setPendingApproval(true)
      } else {
        setError(result.error || 'Registration failed')
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
                Create Account
              </h2>
              <p className="text-sm sm:text-base font-poppins text-[#65758b]">
                Start your benchmarking journey
              </p>
            </div>

            {/* Success Message */}
            {pendingApproval && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 mb-5">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-poppins font-semibold text-yellow-900 mb-1">
                      Registration Successful!
                    </h3>
                    <p className="text-sm font-poppins text-yellow-800 mb-3">
                      Your account has been created and is pending admin approval. You will receive a notification once your account is approved.
                    </p>
                    <button
                      onClick={() => navigate('/login')}
                      className="text-sm font-poppins font-medium text-[#3c83f6] hover:underline"
                    >
                      Go to Login →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-poppins mb-5">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full h-12 bg-[#f9fafb] border-0 rounded-xl pl-12 pr-4 text-sm font-poppins text-[#0f1729] placeholder-[#9ca3af] focus:ring-2 focus:ring-[#b455a0] focus:bg-white transition-all"
                  placeholder="Full Name"
                />
              </div>

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

              {/* Password Input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <Lock className="w-5 h-5 text-[#9ca3af]" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full h-12 bg-[#f9fafb] border-0 rounded-xl pl-12 pr-12 text-sm font-poppins text-[#0f1729] placeholder-[#9ca3af] focus:ring-2 focus:ring-[#b455a0] focus:bg-white transition-all"
                  placeholder="Password"
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
                {loading ? 'Creating Account...' : 'Create Account'}
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
              Already have an account?{' '}
              <Link to="/login" className="text-[#3c83f6] font-medium hover:underline">
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
