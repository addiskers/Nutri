import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import authService from '../../services/api'
import { debugLog } from '../../utils/debugLog'

const Layout = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [userRefreshKey, setUserRefreshKey] = useState(0)

  useEffect(() => {
    let lastCheck = Date.now()

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        if (now - lastCheck > 30000) {
          lastCheck = now
          try {
            await authService.getCurrentUserInfo()
            setUserRefreshKey(prev => prev + 1)
          } catch (error) {
            console.error('Failed to refresh user data:', error)
          }
        }
      }
    }

    const handlePermissionsChanged = () => {
      debugLog('Permissions changed - updating sidebar immediately')
      setUserRefreshKey(prev => prev + 1)
    }

    const refreshInterval = setInterval(async () => {
      try {
        const oldUser = authService.getCurrentUser()
        await authService.getCurrentUserInfo()
        const newUser = authService.getCurrentUser()

        if (JSON.stringify(oldUser?.permissions) !== JSON.stringify(newUser?.permissions)) {
          setUserRefreshKey(prev => prev + 1)
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error)
      }
    }, 30000)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('permissionsChanged', handlePermissionsChanged)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('permissionsChanged', handlePermissionsChanged)
      clearInterval(refreshInterval)
    }
  }, [])

  return (
    <div className="flex h-screen bg-[#f3f3f3] overflow-hidden">
      <Sidebar key={userRefreshKey} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      
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

