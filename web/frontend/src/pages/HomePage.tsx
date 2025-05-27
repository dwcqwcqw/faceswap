import { Link } from 'react-router-dom'
import { 
  PhotoIcon, 
  VideoCameraIcon, 
  UserGroupIcon,
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

const features = [
  {
    title: '单人图片换脸',
    description: '上传原图和目标人脸，AI将自动识别并进行换脸处理，操作简单快速。',
    icon: PhotoIcon,
    href: '/single-image',
    color: 'from-blue-500 to-cyan-600'
  },
  {
    title: '多人图片换脸',
    description: '自动检测图片中的多个人脸，可以分别为每个人脸上传不同的替换图片。',
    icon: UserGroupIcon,
    href: '/multi-image',
    color: 'from-purple-500 to-pink-600'
  },
  {
    title: '视频换脸',
    description: '为视频中的人脸进行换脸处理，采用逐帧处理技术确保视频流畅自然。',
    icon: VideoCameraIcon,
    href: '/video',
    color: 'from-green-500 to-emerald-600'
  },
  {
    title: '多人视频换脸',
    description: '高级视频处理功能，检测视频中的多个人脸并分别进行替换处理。',
    icon: SparklesIcon,
    href: '/multi-video',
    color: 'from-orange-500 to-red-600'
  }
]

export default function HomePage() {
  return (
    <div className="container-xs sm:max-w-7xl mx-auto py-6 sm:py-8 lg:py-12 px-3 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center mb-8 sm:mb-12 lg:mb-16 animate-fade-in">
        <h1 className="heading-responsive bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mb-4 sm:mb-6">
          AI智能换脸技术
        </h1>
        <p className="text-mobile-body sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-2 sm:px-0 leading-relaxed">
          基于先进AI技术的图片和视频换脸平台，支持单人和多人换脸，
          提供专业级的处理效果和用户体验。
        </p>
        <div className="mt-6 sm:mt-8 lg:mt-10">
          <Link
            to="/single-image"
            className="btn-mobile sm:inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus-enhanced transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl w-full sm:w-auto justify-center"
          >
            <SparklesIcon className="h-5 w-5 mr-2" />
            立即开始
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="responsive-grid mb-8 sm:mb-12 lg:mb-16">
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <Link
              key={feature.title}
              to={feature.href}
              className="group relative bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden transform hover:-translate-y-1 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
              <div className="relative p-4 sm:p-6 lg:p-8">
                <div className={`inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-to-br ${feature.color} mb-4 sm:mb-6 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <h3 className="text-mobile-title sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3 group-hover:text-primary-600 transition-colors duration-200">
                  {feature.title}
                </h3>
                <p className="text-mobile-body sm:text-base text-gray-600 mb-3 sm:mb-4 leading-relaxed">
                  {feature.description}
                </p>
                <div className="inline-flex items-center text-primary-600 font-medium group-hover:text-primary-700 text-sm sm:text-base">
                  立即尝试
                  <ArrowRightIcon className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Key Features */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8 mb-8 sm:mb-12">
        <h2 className="text-mobile-title sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 lg:mb-8 text-center">
          为什么选择我们的换脸技术？
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="text-center group animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-green-100 text-green-600 mb-4 group-hover:scale-110 transition-transform duration-200">
              <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-2">处理速度快</h3>
            <p className="text-mobile-body sm:text-base text-gray-600 leading-relaxed">基于RunPod GPU云计算平台，提供高速AI处理能力</p>
          </div>
          <div className="text-center group animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-blue-100 text-blue-600 mb-4 group-hover:scale-110 transition-transform duration-200">
              <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-2">效果逼真</h3>
            <p className="text-mobile-body sm:text-base text-gray-600 leading-relaxed">采用最新的深度学习模型，确保换脸效果自然逼真</p>
          </div>
          <div className="text-center group animate-slide-up sm:col-span-2 lg:col-span-1" style={{ animationDelay: '0.4s' }}>
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-purple-100 text-purple-600 mb-4 group-hover:scale-110 transition-transform duration-200">
              <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-2">安全私密</h3>
            <p className="text-mobile-body sm:text-base text-gray-600 leading-relaxed">数据加密传输，处理完成后自动删除，保护用户隐私</p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg sm:rounded-xl p-4 sm:p-6 animate-slide-up" style={{ animationDelay: '0.5s' }}>
        <div className="flex flex-col sm:flex-row items-start">
          <svg className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500 mt-0.5 mr-0 sm:mr-3 mb-3 sm:mb-0 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-yellow-800 mb-1 sm:mb-2">重要使用说明</h3>
            <p className="text-xs sm:text-sm text-yellow-700 leading-relaxed">
              请负责任地使用本技术。使用他人肖像时请务必获得同意，分享AI生成内容时请明确标注。
              我们严禁创建不当、有害或未经同意的内容。本平台仅供学习研究和正当用途。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 