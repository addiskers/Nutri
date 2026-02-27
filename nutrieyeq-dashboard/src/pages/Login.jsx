import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Upload, Brain, BarChart3 } from 'lucide-react'
import { authService } from '../services/api'

const Login = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('email') // email login only
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState('credentials') // 'credentials' or 'otp'
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [resendTimer, setResendTimer] = useState(0)
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authService.login(formData.email, formData.password)
      
      if (result.success) {
        setStep('otp')
        startResendTimer()
      } else {
        setError(result.error || 'Login failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      value = value[0]
    }
    
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError('')

    if (value && index < 5) {
      otpRefs[index + 1].current?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)
    const newOtp = pastedData.split('').concat(Array(6).fill('')).slice(0, 6)
    setOtp(newOtp)
    
    const nextEmptyIndex = newOtp.findIndex(val => !val)
    if (nextEmptyIndex !== -1) {
      otpRefs[nextEmptyIndex].current?.focus()
    } else {
      otpRefs[5].current?.focus()
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const otpString = otp.join('')
    
    if (otpString.length !== 6) {
      setError('Please enter complete OTP')
      return
    }

    setError('')
    setLoading(true)

    try {
      const result = await authService.verifyLoginOtp(formData.email, otpString)
      
      if (result.success) {
        navigate('/dashboard')
      } else {
        setError(result.error || 'OTP verification failed')
        setOtp(['', '', '', '', '', ''])
        otpRefs[0].current?.focus()
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const startResendTimer = () => {
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleResendOtp = async () => {
    if (resendTimer > 0) return
    
    setError('')
    setLoading(true)

    try {
      const result = await authService.login(formData.email, formData.password)
      
      if (result.success) {
        startResendTimer()
        alert('New OTP sent to your email')
      } else {
        setError(result.error || 'Failed to resend OTP')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

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
              <h1 className="text-[36px] xl:text-[48px] font-ibm-plex font-bold text-white leading-[1.2]">
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

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-[#f3f3f3] p-4 sm:p-6 md:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-6 md:space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <img
              src="/assets/zydus-logo.png"
              alt="Zydus Wellness Logo"
              className="h-12 md:h-14 w-auto object-contain"
            />
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] border border-[rgba(225,231,239,0.5)] p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6 md:mb-8">
              <h2 className="text-xl sm:text-2xl font-poppins font-bold text-[#0f1729] mb-2">
                Welcome Back
              </h2>
              <p className="text-sm sm:text-base font-poppins text-[#65758b]">
                Sign in to your account
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-poppins mb-5">
                {error}
              </div>
            )}

            {/* Email/Password Login */}
            {step === 'credentials' && (
              <>
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="john@company.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {showPassword ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#b455a0] text-white py-3 rounded-lg font-medium hover:bg-[#9d4a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
                    Forgot password?
                  </Link>
                </div>

                <div className="mt-6 text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                    Create account
                  </Link>
                </div>
              </>
            )}

            {/* OTP Verification */}
            {step === 'otp' && (
              <>
                <div className="text-center mb-6">
                  <p className="text-sm text-gray-600">
                    We've sent a verification code to<br />
                    <strong>{formData.email}</strong>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="flex justify-center gap-2">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={otpRefs[index]}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={index === 0 ? handleOtpPaste : undefined}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                  >
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  {resendTimer > 0 ? (
                    <p className="text-sm text-gray-600">Resend OTP in {resendTimer}s</p>
                  ) : (
                    <button
                      onClick={handleResendOtp}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => { setStep('credentials'); setOtp(['', '', '', '', '', '']) }}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    ← Back to login
                  </button>
                </div>
              </>
            )}

            {/* Terms */}
            <p className="text-[11px] sm:text-xs font-poppins text-[#65758b] text-center mt-5 md:mt-6 px-2">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
