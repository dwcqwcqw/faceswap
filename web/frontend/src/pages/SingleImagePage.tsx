import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import TaskHistory from '../components/TaskHistory'
import TaskDetail from '../components/TaskDetail'
import { ArrowPathIcon, DocumentArrowDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api'
import { ProcessingJob } from '../types'
import { taskHistory, TaskHistoryItem } from '../utils/taskHistory'

export default function SingleImagePage() {
  const [sourceImage, setSourceImage] = useState<File | null>(null)
  const [targetFace, setTargetFace] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskHistoryItem | null>(null)

  // 在组件加载时检查是否有活跃任务需要恢复
  useEffect(() => {
    const activeTask = taskHistory.getLatestActiveTask('single-image')
    if (activeTask) {
      console.log('🔄 恢复活跃任务:', activeTask.id)
      setProcessingStatus(activeTask)
      setIsProcessing(true)
      setError(null)
      
      // 恢复轮询
      setTimeout(() => pollJobStatus(activeTask.id), 1000)
    }
  }, [])

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await apiService.getJobStatus(jobId)
      if (response.success && response.data) {
        const status = response.data
        setProcessingStatus(status)
        
        // Update task history
        taskHistory.updateTask(jobId, {
          ...status,
          updated_at: new Date().toISOString()
        })
        
        if (status.status === 'completed') {
          setIsProcessing(false)
        } else if (status.status === 'failed') {
          setIsProcessing(false)
          setError(status.error_message || '处理失败')
        } else {
          // Continue polling if still processing
          setTimeout(() => pollJobStatus(jobId), 3000)
        }
      }
    } catch (error) {
      console.error('Failed to check job status:', error)
      setError('无法获取处理状态')
      setIsProcessing(false)
    }
  }

  const handleProcess = async () => {
    if (!sourceImage || !targetFace) return
    
    setIsProcessing(true)
    setError(null)
    setProcessingStatus(null)

    try {
      // Upload source image
      console.log('上传原图...', sourceImage.name, sourceImage.size)
      const sourceResponse = await apiService.uploadFile(sourceImage)
      console.log('原图上传响应:', sourceResponse)
      
      if (!sourceResponse.success || !sourceResponse.data) {
        throw new Error(`原图上传失败: ${sourceResponse.error || '未知错误'}`)
      }
      
      console.log('✅ 原图上传成功:', sourceResponse.data.fileId)

      // Upload target face
      console.log('上传目标人脸...', targetFace.name, targetFace.size)
      const targetResponse = await apiService.uploadFile(targetFace)
      console.log('目标人脸上传响应:', targetResponse)
      
      if (!targetResponse.success || !targetResponse.data) {
        throw new Error(`目标人脸上传失败: ${targetResponse.error || '未知错误'}`)
      }
      
      console.log('✅ 目标人脸上传成功:', targetResponse.data.fileId)

      // Verify both files can be accessed before processing
      console.log('验证文件可访问性...')
      
      // Start processing only after both uploads are confirmed
      console.log('开始处理...', {
        source_file: sourceResponse.data.fileId,
        target_file: targetResponse.data.fileId
      })
      
      const processResponse = await apiService.processSingleImage({
        source_file: sourceResponse.data.fileId,
        target_file: targetResponse.data.fileId,
        options: {
          mouth_mask: true,
        }
      })

      console.log('处理响应:', processResponse)

      if (processResponse.success && processResponse.data) {
        const jobId = processResponse.data.jobId
        console.log('✅ 处理任务创建成功:', jobId)
        
        const initialStatus: ProcessingJob = {
          id: jobId,
          status: 'pending' as const,
          progress: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        setProcessingStatus(initialStatus)
        
        // Add to task history
        const historyTask: TaskHistoryItem = {
          ...initialStatus,
          title: `单图换脸 - ${sourceImage.name} → ${targetFace.name}`,
          type: 'single-image',
          files: {
            source: sourceImage.name,
            target: targetFace.name
          }
        }
        taskHistory.addTask(historyTask)
        
        // Start polling for status
        setTimeout(() => pollJobStatus(jobId), 2000)
      } else {
        throw new Error(`处理启动失败: ${processResponse.error || '未知错误'}`)
      }
      
    } catch (error: any) {
      console.error('处理错误:', error)
      setError(error.message || '处理过程中出现错误')
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (processingStatus?.result_url) {
      const link = document.createElement('a')
      link.href = apiService.getDownloadUrl(processingStatus.result_url.split('/').pop() || '')
      link.download = 'face-swap-result.jpg'
      link.click()
    }
  }

  const handleTaskSelect = (task: TaskHistoryItem) => {
    setSelectedHistoryTask(task)
    // Clear current processing state to show historical result
    setProcessingStatus(null)
    setIsProcessing(false)
    setError(null)
  }

  const handleCloseTaskDetail = () => {
    setSelectedHistoryTask(null)
  }

  const canProcess = sourceImage && targetFace && !isProcessing

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">单人图片换脸</h1>
        <p className="mt-2 text-lg text-gray-600">
          上传原图和目标人脸，开始AI换脸处理
        </p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-center">
            <div className="text-blue-800 text-sm">
              💡 <strong>注意：</strong>此页面仅支持图片换脸。如需处理视频，请前往 
              <a href="/video" className="text-blue-600 hover:text-blue-800 underline ml-1">视频换脸页面</a>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">处理错误</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              
              {/* 错误类型判断和建议 */}
              <div className="mt-3 text-sm text-red-600">
                {error.includes('unexpected EOF') || error.includes('corrupted') ? (
                  <div className="bg-red-100 p-3 rounded border-l-4 border-red-500">
                    <p className="font-medium">🛠️ 文件损坏问题的解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>请重新选择文件并重试</li>
                      <li>确保文件完整且未损坏</li>
                      <li>尝试使用其他图片格式（JPG/PNG）</li>
                      <li>检查网络连接是否稳定</li>
                    </ul>
                  </div>
                ) : error.includes('timeout') || error.includes('超时') ? (
                  <div className="bg-yellow-100 p-3 rounded border-l-4 border-yellow-500">
                    <p className="font-medium">⏱️ 超时问题的解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>检查网络连接</li>
                      <li>尝试压缩图片大小</li>
                      <li>稍后重试</li>
                    </ul>
                  </div>
                ) : error.includes('format') || error.includes('格式') ? (
                  <div className="bg-blue-100 p-3 rounded border-l-4 border-blue-500">
                    <p className="font-medium">📁 格式问题的解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>确保使用支持的图片格式（JPG、PNG）</li>
                      <li>避免使用损坏或特殊格式的文件</li>
                      <li>尝试重新保存图片</li>
                    </ul>
                  </div>
                ) : (
                  <div className="bg-gray-100 p-3 rounded border-l-4 border-gray-500">
                    <p className="font-medium">💡 通用解决方案：</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>检查网络连接</li>
                      <li>刷新页面重试</li>
                      <li>更换不同的图片文件</li>
                      <li>稍后再试</li>
                    </ul>
                  </div>
                )}
              </div>
              
              {/* 重试按钮 */}
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  关闭错误信息
                </button>
                {canProcess && (
                  <button
                    onClick={handleProcess}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <ArrowPathIcon className="h-4 w-4 mr-1" />
                    重试处理
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Source Image Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
          {sourceImage && (
            <div className="mt-4">
              <img
                src={URL.createObjectURL(sourceImage)}
                alt="原图"
                className="w-full h-48 object-cover rounded-lg"
              />
              <p className="text-sm text-gray-500 mt-2">
                文件大小: {(sourceImage.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        {/* Target Face Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
          {targetFace && (
            <div className="mt-4">
              <img
                src={URL.createObjectURL(targetFace)}
                alt="目标人脸"
                className="w-full h-48 object-cover rounded-lg"
              />
              <p className="text-sm text-gray-500 mt-2">
                文件大小: {(targetFace.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Process Button */}
      <div className="text-center mb-8">
        <button
          onClick={handleProcess}
          disabled={!canProcess}
          className={`
            inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md
            ${canProcess
              ? 'text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
              : 'text-gray-400 bg-gray-200 cursor-not-allowed'
            }
            transition-colors
          `}
        >
          {isProcessing ? (
            <>
              <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
              处理中...
            </>
          ) : (
            <>
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              开始换脸
            </>
          )}
        </button>
      </div>

      {/* Processing Status */}
      {processingStatus && isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            <div className="loading-spinner mr-3"></div>
            <div>
              <h3 className="text-lg font-medium text-blue-900">正在处理您的换脸请求</h3>
              <p className="text-blue-700">
                任务ID: {processingStatus.id}
              </p>
              <p className="text-blue-700">
                状态: {processingStatus.status} | 进度: {processingStatus.progress}%
              </p>
            </div>
          </div>
          <div className="mt-4 bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${processingStatus.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Result */}
      {processingStatus?.status === 'completed' && processingStatus.result_url && !isProcessing && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">换脸结果</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <img
                src={apiService.getDownloadUrl(processingStatus.result_url.split('/').pop() || '')}
                alt="换脸结果"
                className="w-full rounded-lg shadow-sm"
                onError={(e) => {
                  console.error('Image load error:', e);
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+加载失败</dGV4dD48L3N2Zz4=';
                }}
              />
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-lg font-medium text-gray-900 mb-2">换脸完成！</h4>
              <p className="text-gray-600 mb-4">
                您的换脸结果已生成，点击下载按钮保存图片。
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                下载结果
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail */}
      {selectedHistoryTask && (
        <TaskDetail 
          task={selectedHistoryTask} 
          onClose={handleCloseTaskDetail}
        />
      )}

      {/* Task History - 只显示单人图片换脸的任务历史 */}
      <TaskHistory 
        onTaskSelect={handleTaskSelect} 
        taskType="single-image"
      />

      {/* Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">获得最佳效果的建议:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• 使用高分辨率、人脸清晰、光线充足的图片</li>
          <li>• 确保目标人脸图片中的人脸朝向正前方</li>
          <li>• 单人换脸请避免使用多人脸图片</li>
          <li>• 尽量使用光线条件相似的图片</li>
          <li>• 支持多种图片格式：JPG、PNG、BMP、TIFF、WebP、GIF、HEIC等</li>
        </ul>
      </div>
    </div>
  )
} 