import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Calendar, User, LogOut, Settings } from 'lucide-react'
import authService from '../../services/api'

const Navbar = ({ 
  showSearch = false, 
  searchPlaceholder = '',
  showFilters = false,
  onSearchChange,
  onCategoryChange,
  onDateFilter 
}) => {
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef(null)
  const currentUser = authService.getCurrentUser()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    authService.logout()
  }

  const getUserInitials = () => {
    if (!currentUser?.name) return 'U'
    return currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
  }

  return (
    <header className="bg-white border-b border-[#e1e7ef] h-16 flex items-center justify-between px-6">
      {/* Branded Title */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl sm:text-[32px] font-ibm-plex font-bold leading-8">
          <span className="text-[#009da5]">Zydus </span>
          <span className="text-[#b455a0]">Wellness - </span>
          <span className="text-[#0f1729]">Nutri</span>
          <span className="text-[#b455a0]">Eye</span>
          <span className="text-[#0f1729]">Q</span>
        </h1>
      </div>

      {/* User Menu */}
      <div className="flex items-center relative" ref={menuRef}>
        {/* User Avatar */}
        <button 
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-10 h-10 bg-[#2463eb] rounded-full flex items-center justify-center text-white font-medium text-sm hover:bg-[#1d4fd8] transition-colors"
        >
          <span className="text-sm font-ibm-plex">{getUserInitials()}</span>
        </button>

        {/* Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute right-0 top-12 w-64 bg-white border border-[#e1e7ef] rounded-lg shadow-lg z-50 py-2">
            {/* User Info */}
            {currentUser && (
              <div className="px-4 py-3 border-b border-[#e1e7ef]">
                <p className="text-sm font-ibm-plex font-semibold text-[#0f1729]">
                  {currentUser.name}
                </p>
                <p className="text-xs font-ibm-plex text-[#65758b] mt-0.5">
                  {currentUser.email}
                </p>
                <p className="text-xs font-ibm-plex text-primary mt-1">
                  {currentUser.role}
                </p>
              </div>
            )}

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={() => {
                  setShowUserMenu(false)
                  navigate('/settings')
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-sm font-ibm-plex text-[#0f1729] hover:bg-[#f9fafb] transition-colors text-left"
              >
                <Settings className="w-4 h-4 text-[#65758b]" />
                <span>Settings</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-sm font-ibm-plex text-[#ef4343] hover:bg-red-50 transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Navbar
