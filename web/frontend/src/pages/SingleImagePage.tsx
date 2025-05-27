import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import TaskDetail from '../components/TaskDetail'
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { TaskHistoryItem } from '../utils/taskHistory'
import { taskManager } from '../utils/taskManager'

export default function SingleImagePage() {
  const [sourceImage, setSourceImage] = useState<File | null>(null)
  const [targetFace, setTargetFace] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskHistoryItem | null>(null)

  const canProcess = sourceImage && targetFace && !isSubmitting

  const handleProcess = async () => {
    if (!sourceImage || !targetFace) {
      setError('请上传原图和目标人脸图片')
      return
    }

    if (!taskManager.canStartNewTask()) {
      setError(`已达到最大并发任务数限制 (${taskManager.getConcurrentTaskCount()}/${5})`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('source_image', sourceImage)
      formData.append('target_image', targetFace)

      console.log('🚀 开始单人图片换脸任务')
      const response = await apiService.singleImageSwap(formData)
      
      if (response.success && response.data?.job_id) {
        const jobId = response.data.job_id
        console.log('✅ 任务创建成功:', jobId)

        // 启动任务管理
        await taskManager.startTask(
          jobId,
          'single-image',
          `单人图片换脸 - ${sourceImage.name}`,
          {
            source: sourceImage.name,
            target: targetFace.name
          }
        )

        console.log('📋 任务已添加到管理器')
        
        // 清空表单
        setSourceImage(null)
        setTargetFace(null)
      } else {
        throw new Error(response.error || '任务创建失败')
      }
    } catch (error: any) {
      console.error('❌ 单人图片换脸失败:', error)
      setError(error.message || '处理失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTaskSelect = (task: TaskHistoryItem) => {
    setSelectedHistoryTask(task)
  }

  const handleCloseTaskDetail = () => {
    setSelectedHistoryTask(null)
  }

  return (
    <div className="container-xs sm:max-w-6xl mx-auto py-4 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8 mb-16 sm:mb-0">
      <div className="text-center mb-4 sm:mb-6 lg:mb-8">
        <h1 className="heading-responsive text-gray-900">单人图片换脸</h1>
        <p className="mt-2 text-mobile-body sm:text-base lg:text-lg text-gray-600 max-w-2xl mx-auto">
          上传原图和目标人脸，开始AI换脸处理
        </p>
        <div className="mt-3 sm:mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-center">
            <div className="text-blue-800 text-xs sm:text-sm text-center">
              💡 <strong>注意：</strong>此页面仅支持图片换脸。如需处理视频，请前往 
              <a href="/video" className="text-blue-600 hover:text-blue-800 underline ml-1">视频换脸页面</a>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 animate-slide-down">
          <div className="flex flex-col">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-red-800">处理错误</h3>
                <p className="text-sm text-red-700 mt-1 break-words">{error}</p>
              </div>
            </div>
            
            {/* 错误类型判断和建议 */}
            <div className="mt-3 text-sm text-red-600">
              {error.includes('unexpected EOF') || error.includes('corrupted') ? (
                <div className="bg-red-100 p-3 rounded border-l-4 border-red-500">
                  <p className="font-medium">🛠️ 文件损坏问题的解决方案：</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-xs sm:text-sm">
                    <li>请重新选择文件并重试</li>
                    <li>确保文件完整且未损坏</li>
                    <li>尝试使用其他图片格式（JPG/PNG）</li>
                    <li>检查网络连接是否稳定</li>
                  </ul>
                </div>
              ) : error.includes('timeout') || error.includes('超时') ? (
                <div className="bg-yellow-100 p-3 rounded border-l-4 border-yellow-500">
                  <p className="font-medium">⏱️ 超时问题的解决方案：</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-xs sm:text-sm">
                    <li>检查网络连接</li>
                    <li>尝试压缩图片大小</li>
                    <li>稍后重试</li>
                  </ul>
                </div>
              ) : error.includes('format') || error.includes('格式') ? (
                <div className="bg-blue-100 p-3 rounded border-l-4 border-blue-500">
                  <p className="font-medium">📁 格式问题的解决方案：</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-xs sm:text-sm">
                    <li>确保使用支持的图片格式（JPG、PNG）</li>
                    <li>避免使用损坏或特殊格式的文件</li>
                    <li>尝试重新保存图片</li>
                  </ul>
                </div>
              ) : (
                <div className="bg-gray-100 p-3 rounded border-l-4 border-gray-500">
                  <p className="font-medium">💡 通用解决方案：</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-xs sm:text-sm">
                    <li>检查网络连接</li>
                    <li>刷新页面重试</li>
                    <li>更换不同的图片文件</li>
                    <li>稍后再试</li>
                  </ul>
                </div>
              )}
            </div>
            
            {/* 重试按钮 */}
            <div className="mt-4 flex flex-col xs:flex-row space-y-2 xs:space-y-0 xs:space-x-3">
              <button
                onClick={() => setError(null)}
                className="touch-target flex-1 xs:flex-initial inline-flex items-center justify-center px-3 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 focus-enhanced transition-colors"
              >
                关闭错误信息
              </button>
              {canProcess && (
                <button
                  onClick={handleProcess}
                  className="touch-target flex-1 xs:flex-initial inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus-enhanced transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1" />
                  重试处理
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="responsive-grid mb-4 sm:mb-6 lg:mb-8">
        {/* Source Image Upload */}
        <div className="card-mobile sm:bg-white sm:rounded-lg sm:shadow-sm sm:border sm:border-gray-200 sm:p-4 lg:p-6">
          <FileUpload
            label="原图"
            description="上传需要换脸的原始图片"
            onFileSelect={setSourceImage}
            currentFile={sourceImage}
            onRemove={() => setSourceImage(null)}
            accept={{ 
              'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.gif', '.heic', '.heif', '.ico', '.svg']
            }}
          />
        </div>

        {/* Target Face Upload */}
        <div className="card-mobile sm:bg-white sm:rounded-lg sm:shadow-sm sm:border sm:border-gray-200 sm:p-4 lg:p-6">
          <FileUpload
            label="目标人脸"
            description="上传要替换的人脸图片"
            onFileSelect={setTargetFace}
            currentFile={targetFace}
            onRemove={() => setTargetFace(null)}
            accept={{ 
              'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.gif', '.heic', '.heif', '.ico', '.svg']
            }}
          />
        </div>
      </div>

      {/* Process Button */}
      <div className="text-center mb-4 sm:mb-6 lg:mb-8">
        <button
          onClick={handleProcess}
          disabled={!canProcess}
          className={`
            btn-mobile w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-lg transition-all duration-200 focus-enhanced transform
            ${canProcess
              ? 'text-white bg-primary-600 hover:bg-primary-700 hover:scale-105 shadow-lg hover:shadow-xl'
              : 'text-gray-400 bg-gray-200 cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? (
            <>
              <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
              <span>提交中...</span>
            </>
          ) : (
            <>
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              <span>开始换脸</span>
            </>
          )}
        </button>
      </div>

      {/* Task Detail */}
      {selectedHistoryTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-full overflow-y-auto">
            <TaskDetail 
              task={selectedHistoryTask} 
              onClose={handleCloseTaskDetail}
            />
          </div>
        </div>
      )}

      {/* Task History - 只显示单人图片换脸的任务历史 */}
      <TaskHistory 
        onTaskSelect={handleTaskSelect} 
        taskType="single-image"
      />

      {/* Tips */}
      <div className="mt-4 sm:mt-6 lg:mt-8 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 sm:p-6 border border-gray-200 animate-slide-up">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          获得最佳效果的建议:
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
            <li className="flex items-start">
              <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
              <span>使用高分辨率、人脸清晰、光线充足的图片</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
              <span>确保目标人脸图片中的人脸朝向正前方</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
              <span>单人换脸请避免使用多人脸图片</span>
            </li>
          </ul>
          <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
            <li className="flex items-start">
              <span className="text-blue-500 mr-2 flex-shrink-0">•</span>
              <span>尽量使用光线条件相似的图片</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2 flex-shrink-0">•</span>
              <span>支持多种图片格式：JPG、PNG、BMP、TIFF、WebP、GIF、HEIC等</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
} 