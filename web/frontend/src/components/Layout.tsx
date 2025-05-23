import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  PhotoIcon, 
  VideoCameraIcon, 
  UserGroupIcon,
  SparklesIcon 
} from '@heroicons/react/24/outline'

interface LayoutProps {
  children: ReactNode
}

const navigation = [
  { name: 'Home', href: '/', icon: SparklesIcon },
  { name: 'Single Image', href: '/single-image', icon: PhotoIcon },
  { name: 'Multi Image', href: '/multi-image', icon: UserGroupIcon },
  { name: 'Video Swap', href: '/video', icon: VideoCameraIcon },
  { name: 'Multi Video', href: '/multi-video', icon: UserGroupIcon },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <SparklesIcon className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">FaceSwap AI</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`
                        inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium
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
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            <p>&copy; 2024 FaceSwap AI. Powered by advanced AI technology.</p>
            <p className="mt-1">Please use responsibly and obtain consent when using real people's faces.</p>
          </div>
        </div>
      </footer>
    </div>
  )
} 