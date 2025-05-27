import { XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { TaskHistoryItem } from '../utils/taskHistory'
import apiService from '../services/api'

interface TaskDetailProps {
  task: TaskHistoryItem
  onClose: () => void
}

export default function TaskDetail({ task, onClose }: TaskDetailProps) {
  const handleDownload = () => {
    if (task.result_url) {
      const link = document.createElement('a')
      link.href = apiService.getDownloadUrl(task.result_url.split('/').pop() || '')
      const extension = task.type === 'video' || task.type === 'multi-video' ? 'mp4' : 'jpg'
      link.download = `${task.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`
      link.click()
    }
  }

  const getTaskTypeLabel = (type: TaskHistoryItem['type']) => {
    switch (type) {
      case 'single-image':
        return '单人图片换脸'
      case 'multi-image':
        return '多人图片换脸'
      case 'video':
        return '视频换脸'
      case 'multi-video':
        return '多人视频换脸'
      default:
        return '任务'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'failed':
        return '失败'
      case 'processing':
        return '处理中'
      default:
        return '等待中'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 truncate">{task.title}</h3>
          <div className="flex flex-col sm:flex-row sm:items-center mt-1 text-sm text-gray-500 space-y-1 sm:space-y-0">
            <span>{getTaskTypeLabel(task.type)}</span>
            <span className="hidden sm:inline mx-2">•</span>
            <span>{getStatusText(task.status)}</span>
            <span className="hidden sm:inline mx-2">•</span>
            <span>{new Date(task.created_at).toLocaleString('zh-CN')}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Task Details */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">任务详情</h4>
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="break-all">
              <span className="font-medium text-gray-700">任务ID:</span>
              <span className="text-gray-600 ml-1 text-xs sm:text-sm">{task.id}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">状态:</span>
              <span className="text-gray-600 ml-1">{getStatusText(task.status)}</span>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <span className="font-medium text-gray-700">创建时间:</span>
              <span className="text-gray-600 ml-1 text-xs sm:text-sm">{new Date(task.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <span className="font-medium text-gray-700">更新时间:</span>
              <span className="text-gray-600 ml-1 text-xs sm:text-sm">{new Date(task.updated_at).toLocaleString('zh-CN')}</span>
            </div>
            {task.progress > 0 && (
              <div className="col-span-1 sm:col-span-2">
                <span className="font-medium text-gray-700">进度:</span>
                <div className="mt-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${task.progress}%` }}
                  ></div>
                </div>
                <span className="text-gray-600 text-xs">{task.progress}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File Information */}
      {task.files && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">文件信息</h4>
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            {task.files.source && (
              <div className="mb-1 break-all">
                <span className="font-medium text-gray-700">源文件:</span>
                <span className="text-gray-600 ml-1 text-xs sm:text-sm">{task.files.source}</span>
              </div>
            )}
            {task.files.target && (
              <div className="mb-1 break-all">
                <span className="font-medium text-gray-700">目标文件:</span>
                <span className="text-gray-600 ml-1 text-xs sm:text-sm">{task.files.target}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {task.status === 'failed' && task.error_message && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-red-900 mb-2">错误信息</h4>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 break-words">
            {task.error_message}
          </div>
        </div>
      )}

      {/* Result */}
      {task.status === 'completed' && task.result_url && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">处理结果</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="order-2 lg:order-1">
              {task.type === 'video' || task.type === 'multi-video' ? (
                <div className="relative">
                  <video
                    src={apiService.getDownloadUrl(task.result_url.split('/').pop() || '')}
                    controls
                    preload="metadata"
                    className="w-full rounded-lg shadow-sm"
                    style={{ maxHeight: '300px' }}
                    onError={(e) => {
                      console.error('Video load error:', e);
                      const target = e.target as HTMLVideoElement;
                      target.style.display = 'none';
                      const errorDiv = target.nextElementSibling as HTMLDivElement;
                      if (errorDiv) {
                        errorDiv.style.display = 'flex';
                      }
                    }}
                    onLoadStart={() => {
                      console.log('Video loading started');
                    }}
                    onCanPlay={() => {
                      console.log('Video can play');
                    }}
                  />
                  <div 
                    className="hidden w-full h-48 sm:h-64 bg-gray-100 rounded-lg shadow-sm flex items-center justify-center"
                    style={{ display: 'none' }}
                  >
                    <div className="text-center p-4">
                      <div className="text-gray-500 mb-2">视频加载失败</div>
                      <button
                        onClick={handleDownload}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        点击下载视频文件
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={apiService.getDownloadUrl(task.result_url.split('/').pop() || '')}
                  alt="处理结果"
                  className="w-full rounded-lg shadow-sm max-h-80 object-contain"
                  onError={(e) => {
                    console.error('Image load error:', e);
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+加载失败</dGV4dD48L3N2Zz4=';
                  }}
                />
              )}
            </div>
            <div className="flex flex-col justify-center order-1 lg:order-2">
              <h5 className="text-lg font-medium text-gray-900 mb-2">任务完成！</h5>
              <p className="text-gray-600 mb-4 text-sm sm:text-base">
                您的{getTaskTypeLabel(task.type)}任务已成功完成，点击下载按钮保存结果。
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 w-full sm:w-auto"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                下载结果
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 