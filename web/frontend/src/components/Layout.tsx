import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  PhotoIcon, 
  VideoCameraIcon, 
  UserGroupIcon,
  SparklesIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface LayoutProps {
  children: ReactNode
}

const navigation = [
  { name: '首页', href: '/', icon: SparklesIcon },
  { name: '单人图片', href: '/single-image', icon: PhotoIcon },
  { name: '多人图片', href: '/multi-image', icon: UserGroupIcon },
  { name: '视频换脸', href: '/video', icon: VideoCameraIcon },
  { name: '多人视频', href: '/multi-video', icon: UserGroupIcon },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Handle resize and detect mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            <div className="flex items-center">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="flex items-center group">
                  <SparklesIcon className="h-7 w-7 sm:h-8 sm:w-8 text-primary-600 group-hover:text-primary-700 transition-colors" />
                  <span className="ml-2 text-lg sm:text-xl font-bold text-gray-900 hidden xs:block group-hover:text-primary-600 transition-colors">
                    FaceSwap AI
                  </span>
                  <span className="ml-2 text-base sm:text-lg font-bold text-gray-900 xs:hidden group-hover:text-primary-600 transition-colors">
                    换脸AI
                  </span>
                </Link>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:ml-6 md:flex md:space-x-6 lg:space-x-8">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`
                        inline-flex items-center px-2 lg:px-3 pt-1 border-b-2 text-sm font-medium transition-all duration-200 focus-enhanced
                        ${isActive
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="touch-target inline-flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus-enhanced transition-colors"
                aria-expanded={mobileMenuOpen}
                aria-label="打开主菜单"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`md:hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen 
            ? 'max-h-96 opacity-100' 
            : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="px-3 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200 shadow-lg">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 touch-target focus-enhanced
                    ${isActive
                      ? 'text-primary-600 bg-primary-50 border-l-4 border-primary-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {isActive && (
                    <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 relative">
        {/* Overlay for mobile menu */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 z-30 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
        )}
        
        <div className="relative z-10">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto relative z-10">
        <div className="max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-xs sm:text-sm text-gray-500 space-y-1 sm:space-y-0">
              <p>&copy; 2024 FaceSwap AI. Powered by advanced AI technology.</p>
              <p className="hidden sm:block mt-1">
                Please use responsibly and obtain consent when using real people's faces.
              </p>
              <p className="sm:hidden">请负责任地使用本技术</p>
            </div>
            
            {/* Mobile-optimized footer links */}
            <div className="mt-3 sm:mt-2 flex flex-wrap justify-center gap-2 sm:gap-4 text-xs text-gray-400">
              <span>学习研究用途</span>
              <span>•</span>
              <span>AI技术驱动</span>
              <span>•</span>
              <span>安全可靠</span>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Mobile-only bottom navigation for key actions */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-bottom">
          <div className="grid grid-cols-4 py-1">
            {navigation.slice(0, 4).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex flex-col items-center justify-center py-2 px-1 text-xs font-medium transition-colors touch-target
                    ${isActive
                      ? 'text-primary-600'
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  <Icon className={`h-5 w-5 mb-1 ${isActive ? 'text-primary-600' : ''}`} />
                  <span className="truncate w-full text-center">
                    {item.name.length > 6 ? item.name.substring(0, 4) + '...' : item.name}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
} 