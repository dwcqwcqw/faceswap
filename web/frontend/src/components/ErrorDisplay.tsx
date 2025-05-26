import { ExclamationTriangleIcon, ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline'
import { analyzeError, getErrorColorClasses } from '../utils/errorHandler'

interface ErrorDisplayProps {
  error: string
  onDismiss: () => void
  onRetry?: () => void
  onDetectFaces?: () => void
  canRetry?: boolean
  canDetect?: boolean
  className?: string
}

export default function ErrorDisplay({ 
  error, 
  onDismiss, 
  onRetry, 
  onDetectFaces,
  canRetry = false, 
  canDetect = false,
  className = "mb-6"
}: ErrorDisplayProps) {
  const errorAnalysis = analyzeError(error)
  const colorClasses = getErrorColorClasses(errorAnalysis.color)

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex">
        <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">处理错误</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          
          {/* 错误类型判断和建议 */}
          <div className="mt-3 text-sm text-red-600">
            <div className={`p-3 rounded ${colorClasses.container}`}>
              <p className={`font-medium ${colorClasses.text}`}>{errorAnalysis.title}</p>
              <ul className={`mt-2 space-y-1 list-disc list-inside ${colorClasses.text}`}>
                {errorAnalysis.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="mt-4 flex space-x-3">
            <button
              onClick={onDismiss}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              关闭错误信息
            </button>
            
            {canRetry && onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <ArrowPathIcon className="h-4 w-4 mr-1" />
                重试处理
              </button>
            )}
            
            {canDetect && onDetectFaces && (
              <button
                onClick={onDetectFaces}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <EyeIcon className="h-4 w-4 mr-1" />
                重新检测人脸
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 