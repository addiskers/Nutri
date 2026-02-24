import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const FlashScreen = () => {
  const navigate = useNavigate()

  // Auto-redirect to login after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login')
    }, 5000)

    return () => clearTimeout(timer)
  }, [navigate])

  const handleLogin = () => {
    navigate('/login')
  }

  const handleCreateAccount = () => {
    navigate('/register')
  }

  return (
    <div className="bg-[#f3f3f3] flex flex-col items-center justify-center px-4 sm:px-6 min-h-screen">
      <div className="flex flex-col gap-6 sm:gap-8 items-center max-w-2xl mx-auto">
        {/* Logo and Text Section */}
        <div className="flex flex-col gap-3 sm:gap-4 items-center">
          {/* Logo */}
          <div className="h-[50px] w-[79px] sm:h-[63.807px] sm:w-[100.631px] relative">
            <img
              src="/assets/zydus-logo-flash.png"
              alt="Zydus Wellness Logo"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Text Content */}
          <div className="flex flex-col gap-2 items-center text-center px-4">
            <h1 className="font-ibm-plex font-semibold text-[20px] sm:text-[24px] leading-7 sm:leading-8 text-[#0f1729]">
              Welcome to NutriEyeQ Kickoff
            </h1>
            <div className="font-poppins text-[14px] sm:text-[16px] leading-5 sm:leading-6 text-[#65758b]">
              <p className="mb-0">Track, upload, and compare products effortlessly with our</p>
              <p>powerful benchmarking platform.</p>
            </div>
          </div>
        </div>

        {/* Buttons Section */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center justify-center w-full sm:w-auto px-4">
          {/* Login Button */}
          <button
            onClick={handleLogin}
            className="bg-[#b455a0] flex gap-2 h-12 items-center justify-center px-6 sm:px-8 rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-[#a04890] transition-colors w-full sm:w-auto min-w-[140px]"
          >
            <span className="font-inter font-medium text-base leading-6 text-white whitespace-nowrap">
              Login
            </span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>

          {/* Create Account Button */}
          <button
            onClick={handleCreateAccount}
            className="bg-white border border-[#e1e7ef] h-12 flex items-center justify-center px-6 sm:px-8 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors w-full sm:w-auto min-w-[140px]"
          >
            <span className="font-poppins font-medium text-base leading-6 text-[#0f1729] whitespace-nowrap">
              Create Account
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default FlashScreen

