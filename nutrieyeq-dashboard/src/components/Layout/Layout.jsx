import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import authService from '../../services/api'

const Layout = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Check for permission updates when page becomes visible
  useEffect(() => {
    let lastCheck = Date.now()

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Only check if more than 30 seconds have passed
        const now = Date.now()
        if (now - lastCheck > 30000) {
          lastCheck = now
          try {
            await authService.getCurrentUserInfo()
            // User data refreshed in localStorage
          } catch (error) {
            console.error('Failed to refresh user data:', error)
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return (
    <div className="flex h-screen bg-[#f3f3f3] overflow-hidden">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout

