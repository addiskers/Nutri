import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Package, 
  Plus, 
  BarChart3, 
  LineChart, 
  FileText, 
  FolderOpen, 
  Beaker,
  FolderKanban,
  Tags,
  Users,
  Settings,
  ChevronLeft
} from 'lucide-react'

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation()

  const mainMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Package, label: 'Products', path: '/products' },
    { icon: Plus, label: 'Add Product', path: '/add-product' },
    { icon: BarChart3, label: 'Compare', path: '/compare' },
    { icon: FileText, label: 'Add COA', path: '/add-coa' },
    { icon: FolderOpen, label: 'COA', path: '/coa' },
    { icon: Beaker, label: 'Formulation', path: '/formulation' },
  ]

  const managementMenuItems = [
    { icon: FolderKanban, label: 'Nomenclature Map', path: '/nomenclature' },
    { icon: Tags, label: 'Tags', path: '/tags' },
    { icon: Users, label: 'Users', path: '/users' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <aside className={`bg-[#0f2c2e] border-r border-[#134346] h-screen flex flex-col transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className="h-16 border-b border-[#134346] flex items-center justify-center px-4">
        <img
          src="/assets/zydus-logo.png"
          alt="Zydus Wellness"
          className={`object-contain transition-all ${isCollapsed ? 'h-6' : 'h-9'}`}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Main Section */}
        <div className="mb-6">
          {!isCollapsed && (
            <div className="px-3 mb-2">
              <p className="text-[10px] font-ibm-plex font-semibold text-white/50 uppercase tracking-wider">
                Main
              </p>
            </div>
          )}
          <div className="space-y-1">
            {mainMenuItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary text-white'
                      : 'text-white/80 hover:bg-[#134346]'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm font-ibm-plex font-medium">
                      {item.label}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Management Section */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2">
              <p className="text-[10px] font-ibm-plex font-semibold text-white/50 uppercase tracking-wider">
                Management
              </p>
            </div>
          )}
          <div className="space-y-1">
            {managementMenuItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary text-white'
                      : 'text-white/80 hover:bg-[#134346]'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm font-ibm-plex font-medium">
                      {item.label}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Collapse Button */}
      <div className="border-t border-[#134346] p-3">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white/70 hover:bg-[#134346] transition-colors"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          {!isCollapsed && (
            <span className="text-sm font-ibm-plex font-medium">
              Collapse
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar

