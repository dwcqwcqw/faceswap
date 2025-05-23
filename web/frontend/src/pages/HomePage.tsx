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
    title: 'Single Image Face Swap',
    description: 'Swap faces in a single image with just two uploads - the original image and the target face.',
    icon: PhotoIcon,
    href: '/single-image',
    color: 'from-blue-500 to-cyan-600'
  },
  {
    title: 'Multi-Person Image Swap',
    description: 'Detect multiple faces in an image and swap each one individually with different target faces.',
    icon: UserGroupIcon,
    href: '/multi-image',
    color: 'from-purple-500 to-pink-600'
  },
  {
    title: 'Video Face Swap',
    description: 'Swap faces in videos with advanced frame-by-frame processing for smooth results.',
    icon: VideoCameraIcon,
    href: '/video',
    color: 'from-green-500 to-emerald-600'
  },
  {
    title: 'Multi-Person Video Swap',
    description: 'Advanced video processing with multiple face detection and individual face replacement.',
    icon: SparklesIcon,
    href: '/multi-video',
    color: 'from-orange-500 to-red-600'
  }
]

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
          AI-Powered <span className="text-primary-600">Face Swapping</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-600">
          Transform images and videos with advanced AI technology. Support for single and multi-person face swapping 
          with professional-grade results.
        </p>
        <div className="mt-8">
          <div className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors">
            <SparklesIcon className="h-5 w-5 mr-2" />
            Get Started
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Link
              key={feature.title}
              to={feature.href}
              className="group relative bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
              <div className="relative p-8">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} mb-6`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {feature.description}
                </p>
                <div className="inline-flex items-center text-primary-600 font-medium group-hover:text-primary-700">
                  Try it now
                  <ArrowRightIcon className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Key Features */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Why Choose Our Face Swap Technology?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 text-green-600 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
            <p className="text-gray-600">Powered by RunPod serverless infrastructure for quick processing</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 text-blue-600 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">High Quality</h3>
            <p className="text-gray-600">Advanced AI models ensure realistic and seamless face swaps</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 text-purple-600 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure & Private</h3>
            <p className="text-gray-600">Your data is processed securely and not stored permanently</p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex">
          <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-yellow-800 mb-1">Important Usage Guidelines</h3>
            <p className="text-sm text-yellow-700">
              Please use this technology responsibly. Always obtain consent when using real people's faces, 
              and clearly label any generated content as AI-manipulated when sharing. We prohibit the creation 
              of inappropriate, harmful, or non-consensual content.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 